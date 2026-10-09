import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { NexoApiClient } from '@nexo/api-client';
import { createNexoMcpServer, requestHasValidToken, startMcpServer } from '../src/server.js';

test('rejects missing or blank MCP tokens before opening a listener', () => {
  const originalToken = process.env.MCP_AUTH_TOKEN;
  delete process.env.MCP_AUTH_TOKEN;
  try {
    assert.throws(() => startMcpServer(), /MCP_AUTH_TOKEN must be set/);
  } finally {
    if (originalToken === undefined) delete process.env.MCP_AUTH_TOKEN;
    else process.env.MCP_AUTH_TOKEN = originalToken;
  }
  assert.throws(() => startMcpServer({ authToken: '' }), /MCP_AUTH_TOKEN must be set/);
  assert.throws(() => startMcpServer({ authToken: '   ' }), /MCP_AUTH_TOKEN must be set/);
});

test('requires the correct Bearer token for every MCP request', () => {
  const token = 'sample-token';
  assert.equal(requestHasValidToken(undefined, token), false);
  assert.equal(requestHasValidToken('Bearer sample-token', ''), false);
  assert.equal(requestHasValidToken('Bearer sample-token', '  '), false);
  assert.equal(requestHasValidToken('sample-token', token), false);
  assert.equal(requestHasValidToken('Bearer wrong-token', token), false);
  assert.equal(requestHasValidToken('Bearer sample-token extra', token), false);
  assert.equal(requestHasValidToken('Bearer sample-token', token), true);
});

test('registers the Nexo tools and forwards task writes to the API client', async () => {
  const taskId = '550e8400-e29b-41d4-a716-446655440003';
  const calls: Array<{ name: string; arguments: unknown }> = [];
  const fakeApi = {
    listProjects: async (filters: unknown) => {
      calls.push({ name: 'listProjects', arguments: filters });
      return [{ id: 'project-1', name: 'Nexo' }];
    },
    getProject: async (id: string) => {
      calls.push({ name: 'getProject', arguments: { id } });
      return { id, name: 'Nexo' };
    },
    listTasks: async (filters: unknown) => {
      calls.push({ name: 'listTasks', arguments: filters });
      return [];
    },
    getTask: async (id: string) => {
      calls.push({ name: 'getTask', arguments: { id } });
      return { id, title: 'Read' };
    },
    createTask: async (input: unknown) => {
      calls.push({ name: 'createTask', arguments: input });
      return { id: taskId, ...(input as object) };
    },
    updateTask: async (id: string, input: unknown) => {
      calls.push({ name: 'updateTask', arguments: { id, ...(input as object) } });
      return { id, ...(input as object) };
    },
    deleteTask: async (id: string) => {
      calls.push({ name: 'deleteTask', arguments: { id } });
    },
    listDeletedTasks: async () => {
      calls.push({ name: 'listDeletedTasks', arguments: {} });
      return [{ id: taskId, title: 'Deleted' }];
    },
    restoreTask: async (id: string) => {
      calls.push({ name: 'restoreTask', arguments: { id } });
      return { id, title: 'Restored' };
    },
  } as unknown as NexoApiClient;

  const server = createNexoMcpServer(fakeApi);
  const client = new Client({ name: 'nexo-mcp-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map(({ name }) => name),
      ['list_projects', 'get_project', 'list_tasks', 'get_task', 'create_task', 'update_task', 'delete_task', 'list_deleted_tasks', 'restore_task'],
    );

    await client.callTool({ name: 'list_projects', arguments: { status: 'active' } });
    await client.callTool({
      name: 'get_project',
      arguments: { id: '550e8400-e29b-41d4-a716-446655440002' },
    });
    await client.callTool({ name: 'list_tasks', arguments: { priority: 'high', status: 'in_review' } });
    await client.callTool({ name: 'get_task', arguments: { id: taskId } });

    const created = await client.callTool({
      name: 'create_task',
      arguments: { title: 'Preparar demo', priority: 'high' },
    });
    assert.equal(created.isError, undefined);
    assert.deepEqual(
      JSON.parse(String(created.content[0]?.type === 'text' ? created.content[0].text : 'null')),
      {
        id: taskId,
        title: 'Preparar demo',
        priority: 'high',
      },
    );

    await client.callTool({
      name: 'update_task',
      arguments: { id: taskId, status: 'in_review' },
    });
    const deleted = await client.callTool({ name: 'delete_task', arguments: { id: taskId } });
    assert.equal(deleted.isError, undefined);
    assert.deepEqual(JSON.parse(String(deleted.content[0]?.type === 'text' ? deleted.content[0].text : 'null')), { deleted: true });
    const deletedTasks = await client.callTool({ name: 'list_deleted_tasks', arguments: {} });
    assert.equal(JSON.parse(String(deletedTasks.content[0]?.type === 'text' ? deletedTasks.content[0].text : 'null'))[0].id, taskId);
    const restored = await client.callTool({ name: 'restore_task', arguments: { id: taskId } });
    assert.equal(JSON.parse(String(restored.content[0]?.type === 'text' ? restored.content[0].text : 'null')).title, 'Restored');

    assert.deepEqual(calls, [
      { name: 'listProjects', arguments: { status: 'active' } },
      { name: 'getProject', arguments: { id: '550e8400-e29b-41d4-a716-446655440002' } },
      { name: 'listTasks', arguments: { priority: 'high', status: 'in_review' } },
      { name: 'getTask', arguments: { id: taskId } },
      { name: 'createTask', arguments: { title: 'Preparar demo', priority: 'high' } },
      { name: 'updateTask', arguments: { id: taskId, status: 'in_review' } },
      { name: 'deleteTask', arguments: { id: taskId } },
      { name: 'listDeletedTasks', arguments: {} },
      { name: 'restoreTask', arguments: { id: taskId } },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});
