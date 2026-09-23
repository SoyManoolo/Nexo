import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { NexoApiClient } from '@nexo/api-client';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '@nexo/contracts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const MCP_PATH = '/mcp';
const HEALTH_PATH = '/health';

export function createNexoMcpServer(
  api = new NexoApiClient(process.env.NEXO_API_BASE_URL ?? 'http://127.0.0.1:3000'),
) {
  const server = new McpServer({ name: 'nexo', version: '0.1.0' });

  server.registerTool(
    'list_projects',
    {
      description: 'Lista los proyectos de Nexo. Filtra por estado activo o archivado.',
      inputSchema: { status: z.enum(['active', 'archived']).optional() },
    },
    async ({ status }) => jsonResult(await api.listProjects(status ? { status } : {})),
  );

  server.registerTool(
    'get_project',
    {
      description: 'Consulta un proyecto de Nexo mediante su UUID.',
      inputSchema: { id: z.string().uuid().describe('UUID del proyecto') },
    },
    async ({ id }) => jsonResult(await api.getProject(id)),
  );

  server.registerTool(
    'list_tasks',
    {
      description:
        'Lista tareas de Nexo. Combina filtros por proyecto, estado, prioridad y fechas.',
      inputSchema: {
        projectId: z.string().uuid().optional(),
        status: z.enum(['inbox', 'next', 'in_progress', 'blocked', 'done']).optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        scheduledFor: z.string().date().optional(),
        dueAt: z.string().datetime().optional(),
      },
    },
    async (filters) => jsonResult(await api.listTasks(filters as ListTasksQuery)),
  );

  server.registerTool(
    'get_task',
    {
      description: 'Consulta una tarea de Nexo mediante su UUID.',
      inputSchema: { id: z.string().uuid().describe('UUID de la tarea') },
    },
    async ({ id }) => jsonResult(await api.getTask(id)),
  );

  server.registerTool(
    'create_task',
    {
      description: 'Crea una tarea en Nexo. Sin estado explícito, se crea en el Inbox.',
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        projectId: z.string().uuid().nullable().optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        pinned: z.boolean().optional(),
        status: z.enum(['inbox', 'next', 'in_progress', 'blocked', 'done']).optional(),
        scheduledFor: z.string().date().nullable().optional(),
        dueAt: z.string().datetime().nullable().optional(),
        startedAt: z.string().datetime().nullable().optional(),
        completedAt: z.string().datetime().nullable().optional(),
        blockedReason: z.string().trim().min(1).nullable().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async (input) => jsonResult(await api.createTask(input as CreateTaskInput)),
  );

  server.registerTool(
    'update_task',
    {
      description: 'Actualiza una tarea existente. Envía solo los campos que quieras cambiar.',
      inputSchema: {
        id: z.string().uuid().describe('UUID de la tarea'),
        title: z.string().trim().min(1).max(200).optional(),
        projectId: z.string().uuid().nullable().optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        pinned: z.boolean().optional(),
        status: z.enum(['inbox', 'next', 'in_progress', 'blocked', 'done']).optional(),
        scheduledFor: z.string().date().nullable().optional(),
        dueAt: z.string().datetime().nullable().optional(),
        startedAt: z.string().datetime().nullable().optional(),
        completedAt: z.string().datetime().nullable().optional(),
        blockedReason: z.string().trim().min(1).nullable().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async ({ id, ...input }) => jsonResult(await api.updateTask(id, input as UpdateTaskInput)),
  );

  return server;
}

function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function requestHasValidToken(
  request: IncomingMessage,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return true;
  const authorization = request.headers.authorization ?? '';
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) return false;

  const provided = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function startMcpServer(
  options: {
    api?: NexoApiClient;
    host?: string;
    port?: number;
    authToken?: string;
  } = {},
) {
  const host = options.host ?? process.env.MCP_HOST ?? '127.0.0.1';
  const port = options.port ?? Number.parseInt(process.env.MCP_PORT ?? '3100', 10);
  const authToken = options.authToken ?? process.env.MCP_AUTH_TOKEN;
  const apiBaseUrl = process.env.NEXO_API_BASE_URL ?? 'http://127.0.0.1:3000';
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (requestUrl.pathname === HEALTH_PATH) {
      try {
        const apiHealth = await fetch(new URL('/health', apiBaseUrl));
        if (!apiHealth.ok) throw new Error('API is unavailable');
        sendJson(response, 200, { status: 'ok' });
      } catch {
        sendJson(response, 503, { status: 'unavailable' });
      }
      return;
    }

    if (requestUrl.pathname !== MCP_PATH) {
      sendJson(response, 404, { error: 'not_found', message: 'Use the /mcp endpoint.' });
      return;
    }

    if (!requestHasValidToken(request, authToken)) {
      sendJson(response, 401, {
        error: 'unauthorized',
        message: 'A valid bearer token is required.',
      });
      return;
    }

    const sessionId = request.headers['mcp-session-id'];
    let transport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;

    if (!transport && request.method !== 'POST') {
      sendJson(response, 400, {
        error: 'invalid_session',
        message: 'Missing or unknown MCP session.',
      });
      return;
    }

    if (!transport) {
      let createdTransport: StreamableHTTPServerTransport;
      createdTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, createdTransport);
        },
      });
      const mcpServer = createNexoMcpServer(options.api);
      createdTransport.onclose = () => {
        const closedSessionId = createdTransport.sessionId;
        if (closedSessionId) sessions.delete(closedSessionId);
        void mcpServer.close().catch((error: unknown) => console.error('MCP session close failed', error));
      };
      await mcpServer.connect(createdTransport);
      transport = createdTransport;
    }

    try {
      await transport.handleRequest(request, response);
    } catch (error) {
      console.error('MCP request failed', error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'internal_error', message: 'MCP request failed.' });
      } else {
        response.end();
      }
    }
  });

  httpServer.listen(port, host, () => {
    console.log(`Nexo MCP listening at http://${host}:${port}${MCP_PATH}`);
  });

  return httpServer;
}
