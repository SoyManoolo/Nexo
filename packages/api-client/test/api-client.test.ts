import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NexoApiClient, NexoApiNotFoundError, NexoApiResponseValidationError, NexoApiServerError, NexoApiValidationError } from '../src/index.js';

const ID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = '2026-01-01T00:00:00.000Z';
const project = () => ({ id: ID, name: 'Project', description: null, color: null, status: 'active', archivedAt: null, createdAt: NOW, updatedAt: NOW });
const task = () => ({ id: ID, title: 'Task', notes: null, projectId: null, status: 'inbox', priority: 'medium', pinned: false, scheduledFor: null, dueAt: null, startedAt: null, completedAt: null, blockedReason: null, createdAt: NOW, updatedAt: NOW });

function clientWith(response: Response, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void) {
  return new NexoApiClient({ baseUrl: 'https://api.example.test/v1/', fetch: async (input, init) => { inspect?.(input, init); return response; } });
}

test('serializa cuerpos de proyecto y conserva las cabeceras JSON', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = clientWith(new Response(JSON.stringify(project()), { status: 201 }), (input, init) => { request = { url: input.toString(), init }; });
  await client.createProject({ name: '  My project  ', description: '  Notes  ' });
  assert.equal(request?.url, 'https://api.example.test/projects');
  assert.equal(request?.init?.method, 'POST');
  assert.equal(new Headers(request?.init?.headers).get('content-type'), 'application/json');
  assert.equal(request?.init?.body, JSON.stringify({ name: 'My project', description: 'Notes' }));
});

test('serializa filtros de tareas y valida listas recibidas', async () => {
  let url = '';
  const client = clientWith(new Response(JSON.stringify([task()])), (input) => { url = input.toString(); });
  assert.equal((await client.listTasks({ projectId: ID, status: 'next', priority: 'high', scheduledFor: '2026-01-02' }))[0]?.title, 'Task');
  assert.equal(url, `https://api.example.test/tasks?projectId=${ID}&status=next&priority=high&scheduledFor=2026-01-02`);
});

test('expone todas las rutas de proyectos y tareas', async () => {
  const requests: Array<{ url: string; method?: string }> = [];
  const client = new NexoApiClient({ baseUrl: 'https://api.example.test/', fetch: async (input, init) => {
    requests.push({ url: input.toString(), method: init?.method });
    const url = input.toString();
    return new Response(JSON.stringify(url.includes('/projects') ? (init?.method === 'GET' && url.includes('?') ? [project()] : project()) : task()));
  } });
  await client.listProjects({ status: 'active' }); await client.getProject(ID); await client.updateProject(ID, { name: 'Renamed' }); await client.archiveProject(ID); await client.deleteProject(ID);
  await client.createTask({ title: 'New task' }); await client.getTask(ID); await client.updateTask(ID, { title: 'Renamed task' }); await client.completeTask(ID); await client.reopenTask(ID); await client.moveTaskToInbox(ID);
  assert.deepEqual(requests, [
    { url: 'https://api.example.test/projects?status=active', method: 'GET' }, { url: `https://api.example.test/projects/${ID}`, method: 'GET' }, { url: `https://api.example.test/projects/${ID}`, method: 'PATCH' }, { url: `https://api.example.test/projects/${ID}/archive`, method: 'POST' }, { url: `https://api.example.test/projects/${ID}`, method: 'DELETE' },
    { url: 'https://api.example.test/tasks', method: 'POST' }, { url: `https://api.example.test/tasks/${ID}`, method: 'GET' }, { url: `https://api.example.test/tasks/${ID}`, method: 'PATCH' }, { url: `https://api.example.test/tasks/${ID}/complete`, method: 'POST' }, { url: `https://api.example.test/tasks/${ID}/reopen`, method: 'POST' }, { url: `https://api.example.test/tasks/${ID}/move-to-inbox`, method: 'POST' },
  ]);
});

test('convierte respuestas 400, 404 y 500 en errores tipados', async () => {
  const cases = [[400, NexoApiValidationError], [404, NexoApiNotFoundError], [500, NexoApiServerError]] as const;
  for (const [status, ErrorType] of cases) {
    await assert.rejects(clientWith(new Response(JSON.stringify({ error: 'example', message: 'Readable error' }), { status })).getProject(ID), (error: unknown) => error instanceof ErrorType && error.message === 'Readable error');
  }
});

test('rechaza respuestas correctas incompatibles con el contrato compartido', async () => {
  await assert.rejects(clientWith(new Response(JSON.stringify({ id: ID, name: 'Incomplete' }))).getProject(ID), NexoApiResponseValidationError);
});
