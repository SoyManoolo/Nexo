import {
  CreateProjectInputSchema, CreateTaskInputSchema, HealthResponseSchema, ListProjectsQuerySchema,
  ProjectActivitySchema,
  GithubCommitSchema, GithubIntegrationStatusSchema, GithubRepositorySchema, ImportGithubProjectInputSchema,
  ListTasksQuerySchema, ProjectSchema, TaskSchema, UpdateProjectInputSchema, UpdateTaskInputSchema,
  type CreateProjectInput, type CreateTaskInput, type HealthResponse, type ListProjectsQuery,
  type ProjectActivity,
  type GithubCommit, type GithubIntegrationStatus, type GithubRepository, type ImportGithubProjectInput,
  type ListTasksQuery, type Project, type Task, type UpdateProjectInput, type UpdateTaskInput,
} from '@nexo/contracts';
import { z, type ZodType } from 'zod';

const ApiErrorBodySchema = z.object({ error: z.string().optional(), message: z.string().optional() });

/** Error base para respuestas HTTP no satisfactorias de la API de Nexo. */
export class NexoApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message); this.name = 'NexoApiError';
  }
}
export class NexoApiValidationError extends NexoApiError {
  constructor(message: string, code?: string) { super(message, 400, code); this.name = 'NexoApiValidationError'; }
}
export class NexoApiNotFoundError extends NexoApiError {
  constructor(message: string, code?: string) { super(message, 404, code); this.name = 'NexoApiNotFoundError'; }
}
export class NexoApiServerError extends NexoApiError {
  constructor(message: string, status: number, code?: string) { super(message, status, code); this.name = 'NexoApiServerError'; }
}
/** La API respondió correctamente, pero su JSON no cumple el contrato compartido. */
export class NexoApiResponseValidationError extends Error {
  constructor(public readonly cause: z.ZodError) {
    super('La API de Nexo devolvió una respuesta incompatible con el contrato.');
    this.name = 'NexoApiResponseValidationError';
  }
}
export class NexoApiTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`La solicitud a la API de Nexo superó el tiempo de espera de ${timeoutMs} ms.`);
    this.name = 'NexoApiTimeoutError';
  }
}

export interface NexoApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  headers?: HeadersInit;
}

/** Cliente compartido para las rutas HTTP de proyectos y tareas de Nexo. */
export class NexoApiClient {
  private readonly baseUrl: URL;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;
  private readonly headers: HeadersInit;

  constructor(options: NexoApiClientOptions | string) {
    const resolved = typeof options === 'string' ? { baseUrl: options } : options;
    this.baseUrl = new URL(resolved.baseUrl);
    this.fetchImplementation = resolved.fetch ?? fetch;
    this.timeoutMs = resolved.timeoutMs ?? 10_000;
    this.headers = resolved.headers ?? {};
  }

  async getHealth(): Promise<HealthResponse> { return this.request('/health', { method: 'GET' }, HealthResponseSchema); }
  async createProject(input: CreateProjectInput): Promise<Project> { return this.requestProject('/projects', { method: 'POST', body: CreateProjectInputSchema.parse(input) }); }
  async listProjects(filters: ListProjectsQuery = {}): Promise<Project[]> { return this.requestProjects('/projects', { method: 'GET', query: ListProjectsQuerySchema.parse(filters) }); }
  async getProject(id: string): Promise<Project> { return this.requestProject(`/projects/${encodeURIComponent(id)}`, { method: 'GET' }); }
  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> { return this.requestProject(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: UpdateProjectInputSchema.parse(input) }); }
  async archiveProject(id: string): Promise<Project> { return this.requestProject(`/projects/${encodeURIComponent(id)}/archive`, { method: 'POST' }); }
  async restoreProject(id: string): Promise<Project> { return this.requestProject(`/projects/${encodeURIComponent(id)}/restore`, { method: 'POST' }); }
  async listProjectActivity(id: string): Promise<ProjectActivity[]> { return this.request(`/projects/${encodeURIComponent(id)}/activity`, { method: 'GET' }, z.array(ProjectActivitySchema)); }
  async deleteProject(id: string): Promise<void> { return this.requestEmpty(`/projects/${encodeURIComponent(id)}`, 'DELETE'); }
  async importGithubProject(input: ImportGithubProjectInput): Promise<Project> { return this.requestProject('/projects/import-github', { method: 'POST', body: ImportGithubProjectInputSchema.parse(input) }); }
  async listGithubCommits(id: string): Promise<GithubCommit[]> { return this.request(`/projects/${encodeURIComponent(id)}/commits`, { method: 'GET' }, z.array(GithubCommitSchema)); }
  async listGithubRepositories(): Promise<GithubRepository[]> { return this.request('/github/repositories', { method: 'GET' }, z.array(GithubRepositorySchema)); }
  async getGithubIntegrationStatus(): Promise<GithubIntegrationStatus> { return this.request('/settings/github', { method: 'GET' }, GithubIntegrationStatusSchema); }
  async saveGithubToken(token: string): Promise<GithubIntegrationStatus> { return this.request('/settings/github', { method: 'PUT', body: { token } }, GithubIntegrationStatusSchema); }
  async removeGithubToken(): Promise<GithubIntegrationStatus> { return this.request('/settings/github', { method: 'DELETE' }, GithubIntegrationStatusSchema); }
  async createTask(input: CreateTaskInput): Promise<Task> { return this.request('/tasks', { method: 'POST', body: CreateTaskInputSchema.parse(input) }, TaskSchema); }
  async listTasks(filters: ListTasksQuery = {}): Promise<Task[]> { return this.request('/tasks', { method: 'GET', query: ListTasksQuerySchema.parse(filters) }, z.array(TaskSchema)); }
  async getTask(id: string): Promise<Task> { return this.request(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' }, TaskSchema); }
  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> { return this.request(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: UpdateTaskInputSchema.parse(input) }, TaskSchema); }
  async completeTask(id: string): Promise<Task> { return this.taskAction(id, 'complete'); }
  async reopenTask(id: string): Promise<Task> { return this.taskAction(id, 'reopen'); }
  async moveTaskToInbox(id: string): Promise<Task> { return this.taskAction(id, 'move-to-inbox'); }

  private async taskAction(id: string, action: string): Promise<Task> { return this.request(`/tasks/${encodeURIComponent(id)}/${action}`, { method: 'POST' }, TaskSchema); }

  private async requestProject(path: string, options: { method: string; body?: unknown; query?: Record<string, string | undefined> }): Promise<Project> {
    const project = await this.request(path, options, ProjectSchema);
    return { ...project, githubRepository: project.githubRepository ?? null };
  }

  private async requestProjects(path: string, options: { method: string; body?: unknown; query?: Record<string, string | undefined> }): Promise<Project[]> {
    const projects = await this.request(path, options, z.array(ProjectSchema));
    return projects.map((project) => ({ ...project, githubRepository: project.githubRepository ?? null }));
  }

  private async requestEmpty(path: string, method: string): Promise<void> {
    const response = await this.fetchImplementation(new URL(path, this.baseUrl), { method, headers: this.headers });
    if (!response.ok) throw await this.toHttpError(response);
  }

  private async request<T>(path: string, options: { method: string; body?: unknown; query?: Record<string, string | undefined> }, schema: ZodType<T>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(this.headers);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    let response: Response;
    try {
      response = await this.fetchImplementation(url, { method: options.method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new NexoApiTimeoutError(this.timeoutMs);
      throw error;
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw await this.toHttpError(response);
    let body: unknown;
    try { body = await response.json(); } catch {
      throw new NexoApiResponseValidationError(new z.ZodError([{ code: 'custom', message: 'Response body is not valid JSON', path: [] }]));
    }
    const result = schema.safeParse(body);
    if (!result.success) throw new NexoApiResponseValidationError(result.error);
    return result.data;
  }

  private async toHttpError(response: Response): Promise<NexoApiError> {
    const body = ApiErrorBodySchema.safeParse(await response.json().catch(() => undefined));
    const message = body.success && body.data.message ? body.data.message : `La API de Nexo respondió con ${response.status}.`;
    const code = body.success ? body.data.error : undefined;
    if (response.status === 400) return new NexoApiValidationError(message, code);
    if (response.status === 404) return new NexoApiNotFoundError(message, code);
    if (response.status >= 500) return new NexoApiServerError(message, response.status, code);
    return new NexoApiError(message, response.status, code);
  }
}
