import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CreateProjectInputSchema,
  CreateTaskInputSchema,
  ListProjectsQuerySchema,
  ListTasksQuerySchema,
  ProjectIdParamsSchema,
  TaskIdParamsSchema,
  UpdateProjectInputSchema,
  UpdateTaskInputSchema,
} from '@nexo/contracts';

test('CreateProjectInputSchema accepts and normalizes a valid project', () => {
  assert.deepEqual(
    CreateProjectInputSchema.parse({
      name: '  Nexo  ',
      description: '  Espacio personal  ',
      color: '#a1B2c3',
    }),
    {
      name: 'Nexo',
      description: 'Espacio personal',
      color: '#a1B2c3',
    },
  );
});

test('CreateProjectInputSchema rejects empty, oversized, unknown, and server-controlled fields', () => {
  assert.throws(() => CreateProjectInputSchema.parse({ name: '   ' }));
  assert.throws(() => CreateProjectInputSchema.parse({ name: 'a'.repeat(121) }));
  assert.throws(() =>
    CreateProjectInputSchema.parse({ name: 'Nexo', status: 'active' }),
  );
  assert.throws(() =>
    CreateProjectInputSchema.parse({ name: 'Nexo', id: '550e8400-e29b-41d4-a716-446655440000' }),
  );
});

test('CreateProjectInputSchema validates colors and turns blank descriptions into null', () => {
  assert.equal(CreateProjectInputSchema.parse({ name: 'Nexo', color: null }).color, null);
  assert.equal(
    CreateProjectInputSchema.parse({ name: 'Nexo', description: '   ' }).description,
    null,
  );
  assert.throws(() => CreateProjectInputSchema.parse({ name: 'Nexo', color: '#fff' }));
  assert.throws(() => CreateProjectInputSchema.parse({ name: 'Nexo', color: 'red' }));
});

test('UpdateProjectInputSchema requires a field and preserves omitted versus null color', () => {
  assert.throws(() => UpdateProjectInputSchema.parse({}));
  assert.deepEqual(UpdateProjectInputSchema.parse({ name: 'Nexo' }), { name: 'Nexo' });
  assert.deepEqual(UpdateProjectInputSchema.parse({ color: null }), { color: null });
  assert.throws(() => UpdateProjectInputSchema.parse({ archivedAt: null }));
});

test('ProjectIdParamsSchema accepts UUIDs and rejects invalid IDs', () => {
  assert.deepEqual(
    ProjectIdParamsSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    { id: '550e8400-e29b-41d4-a716-446655440000' },
  );
  assert.throws(() => ProjectIdParamsSchema.parse({ id: 'not-a-uuid' }));
});

test('ListProjectsQuerySchema accepts only project status filters', () => {
  assert.deepEqual(ListProjectsQuerySchema.parse({ status: 'active' }), { status: 'active' });
  assert.deepEqual(ListProjectsQuerySchema.parse({}), {});
  assert.throws(() => ListProjectsQuerySchema.parse({ status: 'all' }));
  assert.throws(() => ListProjectsQuerySchema.parse({ page: '1' }));
});

test('CreateTaskInputSchema accepts and normalizes a valid task', () => {
  assert.deepEqual(
    CreateTaskInputSchema.parse({
      title: '  Revisar roadmap  ',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      priority: 'high',
      status: 'in_progress',
      scheduledFor: '2026-09-22',
      dueAt: '2026-09-23T10:00:00.000Z',
      startedAt: '2026-09-22T09:00:00.000Z',
      notes: '  Preparar preguntas  ',
    }),
    {
      title: 'Revisar roadmap',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      priority: 'high',
      status: 'in_progress',
      scheduledFor: '2026-09-22',
      dueAt: '2026-09-23T10:00:00.000Z',
      startedAt: '2026-09-22T09:00:00.000Z',
      notes: 'Preparar preguntas',
    },
  );
});

test('CreateTaskInputSchema enforces blocked and done state requirements', () => {
  assert.throws(() => CreateTaskInputSchema.parse({ title: 'Blocked', status: 'blocked' }));
  assert.throws(() => CreateTaskInputSchema.parse({ title: 'Done', status: 'done' }));
  assert.throws(() =>
    CreateTaskInputSchema.parse({ title: 'Active', status: 'next', completedAt: '2026-09-22T10:00:00.000Z' }),
  );
  assert.deepEqual(
    CreateTaskInputSchema.parse({
      title: 'Blocked',
      status: 'blocked',
      blockedReason: 'Waiting for access',
    }).blockedReason,
    'Waiting for access',
  );
  assert.equal(
    CreateTaskInputSchema.parse({
      title: 'Done',
      status: 'done',
      completedAt: '2026-09-22T10:00:00.000Z',
    }).completedAt,
    '2026-09-22T10:00:00.000Z',
  );
});

test('UpdateTaskInputSchema requires at least one allowed field', () => {
  assert.throws(() => UpdateTaskInputSchema.parse({}));
  assert.deepEqual(UpdateTaskInputSchema.parse({ notes: null }), { notes: null });
  assert.deepEqual(UpdateTaskInputSchema.parse({ pinned: true }), { pinned: true });
  assert.throws(() => UpdateTaskInputSchema.parse({ pinned: 'yes' }));
  assert.throws(() => UpdateTaskInputSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' }));
});

test('TaskIdParamsSchema accepts UUIDs and ListTasksQuerySchema validates filters', () => {
  assert.deepEqual(
    TaskIdParamsSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    { id: '550e8400-e29b-41d4-a716-446655440000' },
  );
  assert.throws(() => TaskIdParamsSchema.parse({ id: 'not-a-uuid' }));
  assert.deepEqual(
    ListTasksQuerySchema.parse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'next',
      priority: 'medium',
      scheduledFor: '2026-09-22',
      dueAt: '2026-09-23T10:00:00.000Z',
    }),
    {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'next',
      priority: 'medium',
      scheduledFor: '2026-09-22',
      dueAt: '2026-09-23T10:00:00.000Z',
    },
  );
  assert.throws(() => ListTasksQuerySchema.parse({ status: 'unknown' }));
  assert.throws(() => ListTasksQuerySchema.parse({ scheduledFor: 'tomorrow' }));
});

test('Task schemas support inbox tasks and project task data', () => {
  assert.deepEqual(CreateTaskInputSchema.parse({ title: 'Capture idea' }), {
    title: 'Capture idea',
  });
  assert.deepEqual(
    CreateTaskInputSchema.parse({
      title: 'Ship feature',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      priority: 'high',
    }),
    {
      title: 'Ship feature',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      priority: 'high',
    },
  );
});

test('Task schemas leave project existence validation to the service boundary', () => {
  assert.doesNotThrow(() =>
    CreateTaskInputSchema.parse({
      title: 'Task with project',
      projectId: '550e8400-e29b-41d4-a716-446655440099',
    }),
  );
  assert.throws(() =>
    CreateTaskInputSchema.parse({ title: 'Blocked task', status: 'blocked' }),
  );
  assert.throws(() =>
    UpdateTaskInputSchema.parse({ status: 'blocked', blockedReason: '   ' }),
  );
});
