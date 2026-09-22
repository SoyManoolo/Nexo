import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CreateProjectInputSchema,
  ListProjectsQuerySchema,
  ProjectIdParamsSchema,
  UpdateProjectInputSchema,
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