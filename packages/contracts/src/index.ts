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
 * - `inbox`: tarea capturada, aún sin decidir.
 * - `next`: siguiente acción disponible.
 * - `in_progress`: tarea que estás ejecutando.
 * - `blocked`: necesita algo externo y exige `blockedReason`.
 * - `done`: completada y exige `completedAt`.
 */
export const TaskStatusSchema = z.enum(['inbox', 'next', 'in_progress', 'blocked', 'done']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

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
  })
  .strict();

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

/** Datos aceptados al actualizar un proyecto. */
export const UpdateProjectInputSchema = z
  .object({
    name: ProjectNameInputSchema.optional(),
    description: ProjectDescriptionInputSchema.nullable().optional(),
    color: ProjectColorInputSchema.nullable().optional(),
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
    validateTaskState({ ...input, status: input.status ?? 'inbox' }, context);
  });

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/** Datos aceptados al actualizar una tarea. */
export const UpdateTaskInputSchema = z
  .object({
    title: TaskTitleInputSchema.optional(),
    projectId: EntityIdSchema.nullable().optional(),
    priority: TaskPrioritySchema.optional(),
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
  status: ProjectStatusSchema,
  archivedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Project = z.infer<typeof ProjectSchema>;

/** Tarea que puede pertenecer a un proyecto o permanecer en el inbox. */
export const TaskSchema = z.object({
  id: EntityIdSchema,
  title: z.string().trim().min(1).max(200),
  notes: z.string().nullable(),
  projectId: EntityIdSchema.nullable(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  scheduledFor: z.string().date().nullable(),
  dueAt: TimestampSchema.nullable(),
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  blockedReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Task = z.infer<typeof TaskSchema>;
