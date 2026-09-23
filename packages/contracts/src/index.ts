import { z } from 'zod';

/** Contratos compartidos por la API, la web y el adaptador MCP. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Estados posibles para un proyecto a lo largo de su ciclo de vida. */
export const ProjectStatusSchema = z.enum(['active', 'archived']);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * Estados de trabajo de una tarea:
 * - `pending`: tarea pendiente de empezar.
 * - `in_progress`: tarea que estás ejecutando.
 * - `in_review`: tarea pendiente de revisión.
 * - `blocked`: necesita algo externo y exige `blockedReason`.
 * - `done`: completada y exige `completedAt`.
 */
export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'in_review', 'done', 'blocked']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  in_review: 'En revisión',
  done: 'Completada',
  blocked: 'Bloqueada',
};

/** Prioridad explícita asignada a una tarea. */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

const EntityIdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();

const ProjectNameInputSchema = z.string().trim().min(1).max(120);
const ProjectDescriptionInputSchema = z
  .string()
  .trim()
  .transform((description) => (description === '' ? null : description));
const ProjectColorInputSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const TaskTitleInputSchema = z.string().trim().min(1).max(200);
const TaskNotesInputSchema = z
  .string()
  .trim()
  .transform((notes) => (notes === '' ? null : notes))
  .nullable();
const TaskDateInputSchema = z.string().date();
const TaskTimestampInputSchema = z.string().datetime();

type TaskStateInput = {
  status?: TaskStatus;
  completedAt?: string | null;
  blockedReason?: string | null;
};

function validateTaskState(input: TaskStateInput, context: z.RefinementCtx): void {
  if (input.status === 'blocked' && !input.blockedReason?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blockedReason'],
      message: 'Blocked tasks require a reason',
    });
  }

  if (input.status === 'done' && !input.completedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['completedAt'],
      message: 'Done tasks require completedAt',
    });
  }

  if (input.status !== undefined && input.status !== 'blocked' && input.blockedReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blockedReason'],
      message: 'Only blocked tasks can have a blocked reason',
    });
  }

  if (input.status !== undefined && input.status !== 'done' && input.completedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['completedAt'],
      message: 'Only done tasks can have completedAt',
    });
  }
}

/** Datos aceptados al crear un proyecto. */
export const CreateProjectInputSchema = z
  .object({
    name: ProjectNameInputSchema,
    description: ProjectDescriptionInputSchema.nullable().optional(),
    color: ProjectColorInputSchema.nullable().optional(),
    githubRepository: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

/** Datos aceptados al actualizar un proyecto. */
export const UpdateProjectInputSchema = z
  .object({
    name: ProjectNameInputSchema.optional(),
    description: ProjectDescriptionInputSchema.nullable().optional(),
    color: ProjectColorInputSchema.nullable().optional(),
    githubRepository: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

/** Parámetros de ruta para identificar un proyecto. */
export const ProjectIdParamsSchema = z
  .object({
    id: EntityIdSchema,
  })
  .strict();

export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

/** Filtros disponibles al listar proyectos. */
export const ListProjectsQuerySchema = z
  .object({
    status: ProjectStatusSchema.optional(),
  })
  .strict();

export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;

/** Datos aceptados al crear una tarea. */
export const CreateTaskInputSchema = z
  .object({
    title: TaskTitleInputSchema,
    projectId: EntityIdSchema.nullable().optional(),
    priority: TaskPrioritySchema.optional(),
    pinned: z.boolean().optional(),
    status: TaskStatusSchema.optional(),
    scheduledFor: TaskDateInputSchema.nullable().optional(),
    dueAt: TaskTimestampInputSchema.nullable().optional(),
    startedAt: TaskTimestampInputSchema.nullable().optional(),
    completedAt: TaskTimestampInputSchema.nullable().optional(),
    blockedReason: z.string().trim().min(1).nullable().optional(),
    notes: TaskNotesInputSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    validateTaskState({ ...input, status: input.status ?? 'pending' }, context);
  });

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/** Datos aceptados al actualizar una tarea. */
export const UpdateTaskInputSchema = z
  .object({
    title: TaskTitleInputSchema.optional(),
    projectId: EntityIdSchema.nullable().optional(),
    priority: TaskPrioritySchema.optional(),
    pinned: z.boolean().optional(),
    status: TaskStatusSchema.optional(),
    scheduledFor: TaskDateInputSchema.nullable().optional(),
    dueAt: TaskTimestampInputSchema.nullable().optional(),
    startedAt: TaskTimestampInputSchema.nullable().optional(),
    completedAt: TaskTimestampInputSchema.nullable().optional(),
    blockedReason: z.string().trim().min(1).nullable().optional(),
    notes: TaskNotesInputSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine((input, context) => {
    validateTaskState(input, context);
  });

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

/** Parámetros de ruta para identificar una tarea. */
export const TaskIdParamsSchema = z
  .object({
    id: EntityIdSchema,
  })
  .strict();

export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>;

/** Filtros disponibles al listar tareas. */
export const ListTasksQuerySchema = z
  .object({
    projectId: EntityIdSchema.optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    scheduledFor: TaskDateInputSchema.optional(),
    dueAt: TaskTimestampInputSchema.optional(),
  })
  .strict();

export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;

/** Proyecto del espacio personal del usuario. */
export const ProjectSchema = z.object({
  id: EntityIdSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  githubRepository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).nullable().default(null),
  status: ProjectStatusSchema,
  archivedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const ImportGithubProjectInputSchema = z.object({
  repositoryUrl: z.string().trim().url().max(500),
}).strict();
export type ImportGithubProjectInput = z.infer<typeof ImportGithubProjectInputSchema>;

export const GithubCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  url: z.string().url(),
  author: z.string().nullable(),
  committedAt: TimestampSchema,
});

export const GithubRepositorySchema = z.object({
  fullName: z.string(),
  htmlUrl: z.string().url(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
  updatedAt: TimestampSchema,
});

export const GithubIntegrationStatusSchema = z.object({ connected: z.boolean() });

export const ProjectActivityEventTypeSchema = z.enum([
  'project_created',
  'project_archived',
  'project_restored',
  'task_created',
  'task_added',
  'task_status_changed',
]);

export const ProjectActivitySchema = z.object({
  id: EntityIdSchema,
  projectId: EntityIdSchema,
  taskId: EntityIdSchema.nullable(),
  eventType: ProjectActivityEventTypeSchema,
  taskTitle: z.string().nullable(),
  fromStatus: TaskStatusSchema.nullable(),
  toStatus: TaskStatusSchema.nullable(),
  createdAt: TimestampSchema,
});

export type ProjectActivityEventType = z.infer<typeof ProjectActivityEventTypeSchema>;
export type ProjectActivity = z.infer<typeof ProjectActivitySchema>;

export type GithubCommit = z.infer<typeof GithubCommitSchema>;
export type GithubRepository = z.infer<typeof GithubRepositorySchema>;
export type GithubIntegrationStatus = z.infer<typeof GithubIntegrationStatusSchema>;

export type Project = z.infer<typeof ProjectSchema>;

/** Tarea que puede pertenecer a un proyecto o permanecer en el inbox. */
export const TaskSchema = z.object({
  id: EntityIdSchema,
  title: z.string().trim().min(1).max(200),
  notes: z.string().nullable(),
  projectId: EntityIdSchema.nullable(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  pinned: z.boolean(),
  scheduledFor: z.string().date().nullable(),
  dueAt: TimestampSchema.nullable(),
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  blockedReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Task = z.infer<typeof TaskSchema>;
