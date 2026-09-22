import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Project, ProjectStatus } from '@nexo/contracts';
import type {
  CreateProjectInput,
  ListProjectsOptions,
} from '../src/repositories/project.repository.js';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';

const { createApp } = await import('../src/app.js');
const { ProjectService } = await import('../src/services/project.service.js');

function project(id: string, name: string, status: ProjectStatus, updatedAt: string): Project {
  return {
    id,
    name,
    description: null,
    color: null,
    status,
    archivedAt: status === 'archived' ? updatedAt : null,
    createdAt: updatedAt,
    updatedAt,
  };
}

class InMemoryProjectRepository {
  private readonly projects: Project[] = [
    project('550e8400-e29b-41d4-a716-446655440000', 'Archived project', 'archived', '2026-01-02T00:00:00.000Z'),
    project('550e8400-e29b-41d4-a716-446655440001', 'Active project', 'active', '2026-01-03T00:00:00.000Z'),
  ];

  async create(input: CreateProjectInput): Promise<Project> {
    const created = project(
      '550e8400-e29b-41d4-a716-446655440002',
      input.name,
      'active',
      '2026-01-04T00:00:00.000Z',
    );
    this.projects.push({ ...created, description: input.description ?? null, color: input.color ?? null });
    return created;
  }

  async list(options: ListProjectsOptions = {}): Promise<Project[]> {
    return this.projects
      .filter((item) => !options.status || item.status === options.status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async search(): Promise<Project[]> {
    return [];
  }

  async findById(): Promise<Project | null> {
    return null;
  }

  async update(): Promise<Project | null> {
    return null;
  }

  async archive(): Promise<Project | null> {
    return null;
  }
}

function request(path: string, init?: RequestInit): Promise<Response> {
  const app = createApp(new ProjectService(new InMemoryProjectRepository()));
  return app.request(path, init);
}

test('POST /projects creates a valid project', async () => {
  const response = await request('/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '  New project  ' }),
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).name, 'New project');
});

test('POST /projects rejects an empty name', async () => {
  const response = await request('/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '   ' }),
  });

  assert.equal(response.status, 400);
});

test('GET /projects lists active and archived projects', async () => {
  const activeResponse = await request('/projects?status=active');
  const archivedResponse = await request('/projects?status=archived');

  assert.equal(activeResponse.status, 200);
  assert.deepEqual((await activeResponse.json()).map((item: Project) => item.status), ['active']);
  assert.equal(archivedResponse.status, 200);
  assert.deepEqual((await archivedResponse.json()).map((item: Project) => item.status), ['archived']);
});

test('GET /projects rejects an invalid status', async () => {
  const response = await request('/projects?status=unknown');

  assert.equal(response.status, 400);
});