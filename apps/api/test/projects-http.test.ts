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
    project(
      '550e8400-e29b-41d4-a716-446655440000',
      'Archived project',
      'archived',
      '2026-01-02T00:00:00.000Z',
    ),
    project(
      '550e8400-e29b-41d4-a716-446655440001',
      'Active project',
      'active',
      '2026-01-03T00:00:00.000Z',
    ),
  ];

  async create(input: CreateProjectInput): Promise<Project> {
    const created = project(
      '550e8400-e29b-41d4-a716-446655440002',
      input.name,
      'active',
      '2026-01-04T00:00:00.000Z',
    );
    const projectWithInput = {
      ...created,
      description: input.description ?? null,
      color: input.color ?? null,
    };
    this.projects.push(projectWithInput);
    return projectWithInput;
  }

  async list(options: ListProjectsOptions = {}): Promise<Project[]> {
    return this.projects
      .filter((item) => !options.status || item.status === options.status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async search(): Promise<Project[]> {
    return [];
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.find((item) => item.id === id) ?? null;
  }

  async update(
    id: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>,
  ): Promise<Project | null> {
    const index = this.projects.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated = {
      ...this.projects[index],
      ...input,
      updatedAt: '2026-01-05T00:00:00.000Z',
    };
    this.projects[index] = updated;
    return updated;
  }

  async archive(id: string): Promise<Project | null> {
    const index = this.projects.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    if (this.projects[index].status === 'archived') {
      return this.projects[index];
    }

    const archived = {
      ...this.projects[index],
      status: 'archived' as const,
      archivedAt: '2026-01-06T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
    };
    this.projects[index] = archived;
    return archived;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.projects.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.projects.splice(index, 1);
    return true;
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
    body: JSON.stringify({
      name: '  New project  ',
      description: '  Personal organizer  ',
      color: '#2563EB',
    }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    ...project(
      '550e8400-e29b-41d4-a716-446655440002',
      'New project',
      'active',
      '2026-01-04T00:00:00.000Z',
    ),
    description: 'Personal organizer',
    color: '#2563EB',
  });
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
  assert.deepEqual(
    (await activeResponse.json()).map((item: Project) => item.status),
    ['active'],
  );
  assert.equal(archivedResponse.status, 200);
  assert.deepEqual(
    (await archivedResponse.json()).map((item: Project) => item.status),
    ['archived'],
  );
});

test('GET /projects rejects an invalid status', async () => {
  const response = await request('/projects?status=unknown');

  assert.equal(response.status, 400);
});

test('GET /projects/:id returns an existing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001');

  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, 'Active project');
});

test('GET /projects/:id returns 404 for a missing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440099');

  assert.equal(response.status, 404);
});

test('GET /projects/:id rejects an invalid UUID', async () => {
  const response = await request('/projects/not-a-uuid');

  assert.equal(response.status, 400);
});

test('PATCH /projects/:id updates the name', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed project' }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, 'Renamed project');
});

test('PATCH /projects/:id clears description and color', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description: null, color: null }),
  });
  const updated = await response.json();

  assert.equal(response.status, 200);
  assert.equal(updated.description, null);
  assert.equal(updated.color, null);
  assert.equal(updated.updatedAt, '2026-01-05T00:00:00.000Z');
});

test('PATCH /projects/:id rejects an empty body', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
});

test('PATCH /projects/:id rejects an invalid color', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ color: 'red' }),
  });

  assert.equal(response.status, 400);
});

test('PATCH /projects/:id returns 404 for a missing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440099', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Missing project' }),
  });

  assert.equal(response.status, 404);
});

test('POST /projects/:id/archive archives an active project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001/archive', {
    method: 'POST',
  });
  const archived = await response.json();

  assert.equal(response.status, 200);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.archivedAt, '2026-01-06T00:00:00.000Z');
  assert.equal(archived.updatedAt, '2026-01-06T00:00:00.000Z');
});

test('POST /projects/:id/archive is idempotent for an archived project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440000/archive', {
    method: 'POST',
  });
  const archived = await response.json();

  assert.equal(response.status, 200);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.archivedAt, '2026-01-02T00:00:00.000Z');
});

test('POST /projects/:id/archive returns 404 for a missing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440099/archive', {
    method: 'POST',
  });

  assert.equal(response.status, 404);
});

test('POST /projects/:id/archive rejects an invalid UUID', async () => {
  const response = await request('/projects/not-a-uuid/archive', { method: 'POST' });

  assert.equal(response.status, 400);
});

test('DELETE /projects/:id removes an existing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440001', {
    method: 'DELETE',
  });
  assert.equal(response.status, 204);
});

test('DELETE /projects/:id returns 404 for a missing project', async () => {
  const response = await request('/projects/550e8400-e29b-41d4-a716-446655440099', {
    method: 'DELETE',
  });
  assert.equal(response.status, 404);
});
