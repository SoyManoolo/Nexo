import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  CreateTaskInput,
  ListTasksQuery,
  Project,
  Task,
  UpdateTaskInput,
} from '@nexo/contracts';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';

const { ProjectRepository } = await import('../src/repositories/project.repository.js');
const { TaskRepository } = await import('../src/repositories/task.repository.js');
const { TaskProjectNotFoundError, TaskService, TaskValidationError } = await import(
  '../src/services/task.service.js'
);

const ACTIVE_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440001';
const ARCHIVED_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const MISSING_ID = '550e8400-e29b-41d4-a716-446655440099';

function project(id: string, status: Project['status']): Project {
  return {
    id,
    name: status === 'active' ? 'Active project' : 'Archived project',
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
    title: 'Existing task',
    notes: null,
    projectId: null,
    status: 'inbox',
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

class InMemoryProjectRepository extends ProjectRepository {
  private readonly projects = new Map<string, Project>([
    [ACTIVE_PROJECT_ID, project(ACTIVE_PROJECT_ID, 'active')],
    [ARCHIVED_PROJECT_ID, project(ARCHIVED_PROJECT_ID, 'archived')],
  ]);

  override async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }
}

class InMemoryTaskRepository extends TaskRepository {
  readonly tasks = new Map<string, Task>();

  override async create(input: CreateTaskInput): Promise<Task> {
    const created = task(
      `550e8400-e29b-41d4-a716-4466554400${String(this.tasks.size + 3).padStart(2, '0')}`,
      {
      ...input,
      notes: input.notes ?? null,
      projectId: input.projectId ?? null,
      status: input.status ?? 'inbox',
      priority: input.priority ?? 'medium',
      scheduledFor: input.scheduledFor ?? null,
      dueAt: input.dueAt ?? null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      blockedReason: input.blockedReason ?? null,
      },
    );
    this.tasks.set(created.id, created);
    return created;
  }

  override async list(options: ListTasksQuery = {}): Promise<Task[]> {
    return [...this.tasks.values()].filter(
      (item) =>
        (!options.projectId || item.projectId === options.projectId) &&
        (!options.status || item.status === options.status) &&
        (!options.priority || item.priority === options.priority),
    );
  }

  override async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  override async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const current = this.tasks.get(id);
    if (!current) return null;
    const updated = { ...current, ...input, updatedAt: '2026-01-04T00:00:00.000Z' };
    this.tasks.set(id, updated);
    return updated;
  }
}

function createService() {
  const taskRepository = new InMemoryTaskRepository();
  return {
    repository: taskRepository,
    service: new TaskService(taskRepository, new InMemoryProjectRepository()),
  };
}

test('TaskService creates inbox and project tasks', async () => {
  const { service } = createService();

  const inboxTask = await service.create({ title: 'Capture task' });
  const projectTask = await service.create({ title: 'Plan release', projectId: ACTIVE_PROJECT_ID });

  assert.equal(inboxTask.status, 'inbox');
  assert.equal(inboxTask.projectId, null);
  assert.equal(projectTask.projectId, ACTIVE_PROJECT_ID);
});

test('TaskService rejects missing and archived projects', async () => {
  const { service } = createService();

  await assert.rejects(
    service.create({ title: 'Missing project task', projectId: MISSING_ID }),
    TaskProjectNotFoundError,
  );
  await assert.rejects(
    service.create({ title: 'Archived project task', projectId: ARCHIVED_PROJECT_ID }),
    (error: unknown) =>
      error instanceof TaskValidationError && error.message.includes('archived project'),
  );
});

test('TaskService filters by status, project and priority', async () => {
  const { service } = createService();
  await service.create({ title: 'High next', projectId: ACTIVE_PROJECT_ID, status: 'next', priority: 'high' });
  await service.create({ title: 'Low inbox', priority: 'low' });
  await service.create({ title: 'High other', status: 'next', priority: 'high' });

  const filtered = await service.list({ projectId: ACTIVE_PROJECT_ID, status: 'next', priority: 'high' });
  assert.deepEqual(filtered.map(({ title }) => title), ['High next']);
});

test('TaskService completes, reopens, blocks and moves tasks to inbox', async () => {
  const { repository, service } = createService();
  const created = await service.create({ title: 'Workflow task', projectId: ACTIVE_PROJECT_ID });

  const completed = await service.complete(created.id);
  assert.equal(completed.status, 'done');
  assert.ok(completed.completedAt);

  const reopened = await service.reopen(created.id);
  assert.equal(reopened.status, 'next');
  assert.equal(reopened.completedAt, null);

  const blocked = await service.update(created.id, {
    status: 'blocked',
    blockedReason: 'Waiting for approval',
  });
  assert.equal(blocked.blockedReason, 'Waiting for approval');

  await assert.rejects(
    service.update(created.id, { status: 'blocked', blockedReason: null }),
    TaskValidationError,
  );
  const inbox = await service.moveToInbox(created.id);
  assert.equal(inbox.projectId, null);
  assert.equal(repository.tasks.get(created.id)?.blockedReason, 'Waiting for approval');
});