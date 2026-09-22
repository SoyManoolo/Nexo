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

/** Estados de trabajo de una tarea. `inbox` representa una tarea aún sin clasificar. */
export const TaskStatusSchema = z.enum(['inbox', 'next', 'in_progress', 'blocked', 'done']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Prioridad explícita asignada a una tarea. */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

const EntityIdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();

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
