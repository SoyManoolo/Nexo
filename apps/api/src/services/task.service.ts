import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from '@nexo/contracts';
import { ProjectRepository } from '../repositories/project.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2_000;

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task not found: ${id}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = 'TaskProjectNotFoundError';
  }
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

function normalizeTitle(title: string): string {
  const normalizedTitle = title.trim();

  if (normalizedTitle.length === 0) {
    throw new TaskValidationError('Task title cannot be blank');
  }

  if (normalizedTitle.length > MAX_TITLE_LENGTH) {
    throw new TaskValidationError(`Task title cannot exceed ${MAX_TITLE_LENGTH} characters`);
  }

  return normalizedTitle;
}

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes === undefined || notes === null) {
    return notes ?? null;
  }

  const normalizedNotes = notes.trim();

  if (normalizedNotes.length > MAX_NOTES_LENGTH) {
    throw new TaskValidationError(`Task notes cannot exceed ${MAX_NOTES_LENGTH} characters`);
  }

  return normalizedNotes || null;
}

function normalizeBlockedReason(reason: string | null | undefined): string | null {
  if (reason === undefined || reason === null) {
    return reason ?? null;
  }

  const normalizedReason = reason.trim();
  return normalizedReason || null;
}

export class TaskService {
  constructor(
    private readonly taskRepository = new TaskRepository(),
    private readonly projectRepository = new ProjectRepository(),
  ) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const status = input.status ?? 'inbox';
    const projectId = await this.validateProject(input.projectId);
    const blockedReason = normalizeBlockedReason(input.blockedReason);

    this.validateBlockedState(status, blockedReason);

    return this.taskRepository.create({
      ...input,
      title: normalizeTitle(input.title),
      notes: normalizeNotes(input.notes),
      projectId,
      status,
      completedAt: status === 'done' ? input.completedAt ?? new Date().toISOString() : null,
      blockedReason: status === 'blocked' ? blockedReason : null,
    });
  }

  list(options: ListTasksQuery = {}): Promise<Task[]> {
    return this.taskRepository.list(options);
  }

  async get(id: string): Promise<Task> {
    return this.requireTask(this.taskRepository.findById(id), id);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const currentTask = await this.requireTask(this.taskRepository.findById(id), id);
    const status = input.status ?? currentTask.status;
    const blockedReason = normalizeBlockedReason(
      input.blockedReason === undefined ? currentTask.blockedReason : input.blockedReason,
    );

    this.validateBlockedState(status, blockedReason);

    if (
      status !== 'blocked' &&
      input.blockedReason !== undefined &&
      input.blockedReason !== null
    ) {
      throw new TaskValidationError('Only blocked tasks can have a blocked reason');
    }

    if (
      status !== 'done' &&
      input.completedAt !== undefined &&
      input.completedAt !== null
    ) {
      throw new TaskValidationError('Only done tasks can have a completion date');
    }

    const normalizedInput: UpdateTaskInput = {};

    if (input.title !== undefined) {
      normalizedInput.title = normalizeTitle(input.title);
    }

    if (input.notes !== undefined) {
      normalizedInput.notes = normalizeNotes(input.notes);
    }

    if (input.projectId !== undefined) {
      normalizedInput.projectId = await this.validateProject(input.projectId);
    }

    if (input.priority !== undefined) {
      normalizedInput.priority = input.priority;
    }

    if (input.scheduledFor !== undefined) {
      normalizedInput.scheduledFor = input.scheduledFor;
    }

    if (input.dueAt !== undefined) {
      normalizedInput.dueAt = input.dueAt;
    }

    if (input.startedAt !== undefined) {
      normalizedInput.startedAt = input.startedAt;
    }

    if (input.status !== undefined) {
      normalizedInput.status = status;
    }

    normalizedInput.completedAt =
      status === 'done'
        ? input.completedAt ?? (currentTask.status === 'done' ? currentTask.completedAt : null) ??
          new Date().toISOString()
        : null;
    normalizedInput.blockedReason = status === 'blocked' ? blockedReason : null;

    return this.requireTask(this.taskRepository.update(id, normalizedInput), id);
  }

  complete(id: string): Promise<Task> {
    return this.update(id, { status: 'done' });
  }

  reopen(id: string): Promise<Task> {
    return this.update(id, { status: 'next' });
  }

  moveToInbox(id: string): Promise<Task> {
    return this.update(id, { projectId: null });
  }

  private async validateProject(projectId: string | null | undefined): Promise<string | null> {
    if (projectId === undefined || projectId === null) {
      return projectId ?? null;
    }

    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new TaskProjectNotFoundError(projectId);
    }

    if (project.status === 'archived') {
      throw new TaskValidationError('Tasks cannot be associated with an archived project');
    }

    return projectId;
  }

  private validateBlockedState(status: CreateTaskInput['status'], reason: string | null): void {
    if (status === 'blocked' && !reason) {
      throw new TaskValidationError('Blocked tasks require a reason');
    }
  }

  private async requireTask(taskPromise: Promise<Task | null>, id: string): Promise<Task> {
    const task = await taskPromise;

    if (!task) {
      throw new TaskNotFoundError(id);
    }

    return task;
  }
}
