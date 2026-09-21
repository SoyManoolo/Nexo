import type { Project, ProjectStatus } from '@nexo/contracts';
import {
  type CreateProjectInput,
  type ListProjectsOptions,
  ProjectRepository,
  type UpdateProjectInput,
} from '../repositories/project.repository.js';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2_000;

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

function normalizeName(name: string): string {
  const normalizedName = name.trim();

  if (normalizedName.length === 0) {
    throw new ProjectValidationError('Project name cannot be blank');
  }

  if (normalizedName.length > MAX_NAME_LENGTH) {
    throw new ProjectValidationError(`Project name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }

  return normalizedName;
}

function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  const normalizedDescription = description.trim();

  if (normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new ProjectValidationError(
      `Project description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  return normalizedDescription || null;
}

export class ProjectService {
  constructor(private readonly projectRepository = new ProjectRepository()) {}

  create(input: CreateProjectInput): Promise<Project> {
    return this.projectRepository.create({
      name: normalizeName(input.name),
      description: normalizeDescription(input.description),
    });
  }

  list(options: ListProjectsOptions = {}): Promise<Project[]> {
    return this.projectRepository.list(options);
  }

  search(query: string): Promise<Project[]> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return Promise.resolve([]);
    }

    return this.projectRepository.search(normalizedQuery);
  }

  update(id: string, input: UpdateProjectInput): Promise<Project> {
    const normalizedInput: UpdateProjectInput = {};

    if (input.name !== undefined) {
      normalizedInput.name = normalizeName(input.name);
    }

    if (input.description !== undefined) {
      normalizedInput.description = normalizeDescription(input.description);
    }

    if (Object.keys(normalizedInput).length === 0) {
      throw new ProjectValidationError('At least one project field must be updated');
    }

    return this.requireProject(this.projectRepository.update(id, normalizedInput), id);
  }

  archive(id: string): Promise<Project> {
    return this.requireProject(this.projectRepository.archive(id), id);
  }

  private async requireProject(projectPromise: Promise<Project | null>, id: string): Promise<Project> {
    const project = await projectPromise;

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return project;
  }
}