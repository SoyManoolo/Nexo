import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CreateTaskInput, ListTasksQuery, Project, Task, UpdateTaskInput } from '@nexo/contracts';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';

const { createApp } = await import('../src/app.js');
const { ProjectRepository } = await import('../src/repositories/project.repository.js');
const { TaskRepository } = await import('../src/repositories/task.repository.js');
const { TaskService } = await import('../src/services/task.service.js');

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440001';
const ARCHIVED_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const MISSING_ID = '550e8400-e29b-41d4-a716-446655440099';

function project(id: string, status: Project['status']): Project {
  return {
    id,
    name: 'Project',
    description: null,
    color: null,
    status,
    archivedAt: status === 'archived' ? '2026-01-02T00:00:00.000Z' : null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function task(id: string, input: Partial<Task> = {}): Task {
  return {
    id,
    title: 'Task',
    notes: null,
    projectId: null,
    status: 'pending',
    priority: 'medium',
    scheduledFor: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    ...input,
  };
}

class TestProjectRepository extends ProjectRepository {
  override async findById(id: string): Promise<Project | null> {
    if (id === PROJECT_ID) return project(id, 'active');
    if (id === ARCHIVED_PROJECT_ID) return project(id, 'archived');
    return null;
  }
}

class TestTaskRepository extends TaskRepository {
  private readonly items = new Map<string, Task>();
  private nextId = 3;

  override async create(input: CreateTaskInput): Promise<Task> {
    const created = task(
      `550e8400-e29b-41d4-a716-4466554400${String(this.nextId++).padStart(2, '0')}`,
      {
      ...input,
      projectId: input.projectId ?? null,
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
      notes: input.notes ?? null,
      scheduledFor: input.scheduledFor ?? null,
      dueAt: input.dueAt ?? null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      blockedReason: input.blockedReason ?? null,
      },
    );
    this.items.set(created.id, created);
    return created;
  }

  override async list(options: ListTasksQuery = {}): Promise<Task[]> {
    return [...this.items.values()].filter(
      (item) =>
        (!options.projectId || item.projectId === options.projectId) &&
        (!options.status || item.status === options.status) &&
        (!options.priority || item.priority === options.priority),
    );
  }

  override async findById(id: string): Promise<Task | null> {
    return this.items.get(id) ?? null;
  }

  override async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const current = this.items.get(id);
    if (!current) return null;
    const updated = { ...current, ...input, updatedAt: '2026-01-04T00:00:00.000Z' };
    this.items.set(id, updated);
    return updated;
  }
}

function setup() {
  const taskRepository = new TestTaskRepository();
  const app = createApp(undefined, new TaskService(taskRepository, new TestProjectRepository()));
  return { app, taskRepository };
}

test('POST /tasks creates inbox and project tasks', async () => {
  const { app } = setup();
  const inboxResponse = await app.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Capture task' }),
  });
  const projectResponse = await app.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Plan release', projectId: PROJECT_ID }),
  });

  assert.equal(inboxResponse.status, 201);
  assert.equal((await inboxResponse.json()).projectId, null);
  assert.equal(projectResponse.status, 201);
  assert.equal((await projectResponse.json()).projectId, PROJECT_ID);
});

test('POST /tasks rejects missing and archived projects', async () => {
  const { app } = setup();
  for (const projectId of [MISSING_ID, ARCHIVED_PROJECT_ID]) {
    const response = await app.request('/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Invalid project task', projectId }),
    });
    assert.equal(response.status, projectId === MISSING_ID ? 404 : 400);
  }
});

test('GET /tasks filters by status, project and priority', async () => {
  const { app } = setup();
  const create = (body: object) =>
    app.request('/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  await create({ title: 'Matching', projectId: PROJECT_ID, status: 'in_review', priority: 'high' });
  await create({ title: 'Different status', projectId: PROJECT_ID, status: 'pending', priority: 'high' });
  await create({ title: 'Different project', status: 'in_review', priority: 'high' });

  const response = await app.request(`/tasks?projectId=${PROJECT_ID}&status=in_review&priority=high`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).map((item: Task) => item.title), ['Matching']);
});

test('Task actions complete, reopen, block and move a task to inbox', async () => {
  const { app } = setup();
  const createResponse = await app.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Workflow', projectId: PROJECT_ID }),
  });
  const id = (await createResponse.json()).id;

  const complete = await app.request(`/tasks/${id}/complete`, { method: 'POST' });
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).status, 'done');
  const reopen = await app.request(`/tasks/${id}/reopen`, { method: 'POST' });
  assert.equal((await reopen.json()).status, 'in_review');
  const block = await app.request(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'blocked', blockedReason: 'Waiting' }),
  });
  assert.equal((await block.json()).blockedReason, 'Waiting');
  const move = await app.request(`/tasks/${id}/move-to-inbox`, { method: 'POST' });
  assert.equal((await move.json()).projectId, null);
});

test('POST /tasks rejects a blocked task without a reason', async () => {
  const { app } = setup();
  const response = await app.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Blocked task', status: 'blocked' }),
  });
  assert.equal(response.status, 400);
});

test('GET /tasks/:id returns 404 for a valid but missing UUID', async () => {
  const { app, taskRepository } = setup();
  const response = await app.request(`/tasks/${MISSING_ID}`);

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
  assert.equal(await taskRepository.findById(MISSING_ID), null);
});
