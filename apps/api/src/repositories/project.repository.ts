import type { Project, ProjectStatus } from '@nexo/contracts';
import { desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, type ProjectRow } from '../db/schema.js';

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  color?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  color?: string | null;
};

export type ListProjectsOptions = {
  status?: ProjectStatus;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ProjectRepository {
  async create(input: CreateProjectInput): Promise<Project> {
    const [project] = await db.insert(projects).values(input).returning();
    return toProject(project);
  }

  async list(options: ListProjectsOptions = {}): Promise<Project[]> {
    const rows = await db
      .select()
      .from(projects)
      .where(options.status ? eq(projects.status, options.status) : undefined)
      .orderBy(desc(projects.updatedAt), desc(projects.id));

    return rows.map(toProject);
  }

  async search(query: string): Promise<Project[]> {
    const pattern = `%${query}%`;
    const rows = await db
      .select()
      .from(projects)
      .where(or(ilike(projects.name, pattern), ilike(projects.description, pattern)))
      .orderBy(desc(projects.updatedAt), desc(projects.id));

    return rows.map(toProject);
  }

  async findById(id: string): Promise<Project | null> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project ? toProject(project) : null;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    const [project] = await db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    return project ? toProject(project) : null;
  }

  async archive(id: string): Promise<Project | null> {
    const currentProject = await this.findById(id);

    if (!currentProject || currentProject.status === 'archived') {
      return currentProject;
    }

    const now = new Date();
    const [project] = await db
      .update(projects)
      .set({ status: 'archived', archivedAt: now, updatedAt: now })
      .where(eq(projects.id, id))
      .returning();

    return project ? toProject(project) : null;
  }
}
