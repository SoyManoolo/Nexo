import type { Project, ProjectStatus } from '@nexo/contracts';
import { databasePool } from '../db/index.js';

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at?: Date | string | null;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
};

export type ListProjectsOptions = {
  status?: ProjectStatus;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class ProjectRepository {
  async create(input: CreateProjectInput): Promise<Project> {
    const result = await databasePool.query<ProjectRow>(
      `
        INSERT INTO projects (name, description)
        VALUES ($1, $2)
        RETURNING id, name, description, status, created_at, updated_at
      `,
      [input.name, input.description ?? null],
    );

    return toProject(result.rows[0]);
  }

  async list(options: ListProjectsOptions = {}): Promise<Project[]> {
    const result = await databasePool.query<ProjectRow>(
      `
        SELECT id, name, description, status, created_at, updated_at
        FROM projects
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY updated_at DESC, id DESC
      `,
      [options.status ?? null],
    );

    return result.rows.map(toProject);
  }

  async search(query: string): Promise<Project[]> {
    const result = await databasePool.query<ProjectRow>(
      `
        SELECT id, name, description, status, created_at, updated_at
        FROM projects
        WHERE name ILIKE $1 OR description ILIKE $1
        ORDER BY updated_at DESC, id DESC
      `,
      [`%${query}%`],
    );

    return result.rows.map(toProject);
  }

  async findById(id: string): Promise<Project | null> {
    const result = await databasePool.query<ProjectRow>(
      `
        SELECT id, name, description, status, created_at, updated_at
        FROM projects
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? toProject(result.rows[0]) : null;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];

    if (input.name !== undefined) {
      values.push(input.name);
      fields.push(`name = $${values.length}`);
    }

    if (input.description !== undefined) {
      values.push(input.description);
      fields.push(`description = $${values.length}`);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(new Date());
    fields.push(`updated_at = $${values.length}`);

    const result = await databasePool.query<ProjectRow>(
      `
        UPDATE projects
        SET ${fields.join(', ')}
        WHERE id = $1
        RETURNING id, name, description, status, created_at, updated_at
      `,
      values,
    );

    return result.rows[0] ? toProject(result.rows[0]) : null;
  }

  async archive(id: string): Promise<Project | null> {
    const result = await databasePool.query<ProjectRow>(
      `
        UPDATE projects
        SET status = 'archived', archived_at = $2, updated_at = $2
        WHERE id = $1
        RETURNING id, name, description, status, created_at, updated_at
      `,
      [id, new Date()],
    );

    return result.rows[0] ? toProject(result.rows[0]) : null;
  }
}