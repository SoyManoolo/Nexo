import type { Project, ProjectStatus } from '@nexo/contracts';
import {
  type CreateProjectInput,
  type ListProjectsOptions,
  ProjectRepository,
  type UpdateProjectInput,
} from '../repositories/project.repository.js';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2_000;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function normalizeGithubRepository(repository: string | null | undefined): string | null | undefined {
  if (repository === undefined || repository === null || repository === '') return repository ?? null;
  const value = repository.trim();
  let canonical = value;
  if (value.startsWith('https://github.com/')) {
    canonical = value.slice('https://github.com/'.length).replace(/\/$/, '').replace(/\.git$/, '');
  }
  if (!GITHUB_REPOSITORY_PATTERN.test(canonical)) {
    throw new ProjectValidationError('Introduce una URL válida de un repositorio GitHub');
  }
  return canonical;
}

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

function normalizeColor(color: string | null | undefined): string | null {
  if (color === undefined || color === null) {
    return color ?? null;
  }

  if (!COLOR_PATTERN.test(color)) {
    throw new ProjectValidationError('Project color must be a six-digit hexadecimal value');
  }

  return color;
}

export class ProjectService {
  constructor(private readonly projectRepository = new ProjectRepository()) {}

  create(input: CreateProjectInput): Promise<Project> {
    return this.projectRepository.create({
      name: normalizeName(input.name),
      description: normalizeDescription(input.description),
      color: normalizeColor(input.color),
      githubRepository: normalizeGithubRepository(input.githubRepository),
    });
  }

  list(options: ListProjectsOptions = {}): Promise<Project[]> {
    return this.projectRepository.list(options);
  }

  get(id: string): Promise<Project> {
    return this.requireProject(this.projectRepository.findById(id), id);
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

    if (input.color !== undefined) {
      normalizedInput.color = normalizeColor(input.color);
    }

    if (input.githubRepository !== undefined) {
      normalizedInput.githubRepository = normalizeGithubRepository(input.githubRepository);
    }

    if (Object.keys(normalizedInput).length === 0) {
      throw new ProjectValidationError('At least one project field must be updated');
    }

    return this.requireProject(this.projectRepository.update(id, normalizedInput), id);
  }

  archive(id: string): Promise<Project> {
    return this.requireProject(this.projectRepository.archive(id), id);
  }

  async delete(id: string): Promise<void> {
    if (!await this.projectRepository.delete(id)) throw new ProjectNotFoundError(id);
  }

  private async requireProject(
    projectPromise: Promise<Project | null>,
    id: string,
  ): Promise<Project> {
    const project = await projectPromise;

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return project;
  }
}
