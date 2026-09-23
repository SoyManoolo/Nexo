import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { NexoApiClient } from '@nexo/api-client';
import { createNexoMcpServer } from '../src/server.js';

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
      ['list_projects', 'get_project', 'list_tasks', 'get_task', 'create_task', 'update_task'],
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

    assert.deepEqual(calls, [
      { name: 'listProjects', arguments: { status: 'active' } },
      { name: 'getProject', arguments: { id: '550e8400-e29b-41d4-a716-446655440002' } },
      { name: 'listTasks', arguments: { priority: 'high', status: 'in_review' } },
      { name: 'getTask', arguments: { id: taskId } },
      { name: 'createTask', arguments: { title: 'Preparar demo', priority: 'high' } },
      { name: 'updateTask', arguments: { id: taskId, status: 'in_review' } },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});
