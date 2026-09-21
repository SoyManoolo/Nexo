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
export const TaskStatusSchema = z.enum(['inbox', 'todo', 'in_progress', 'done', 'cancelled']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Prioridad explícita asignada a una tarea. */
export const TaskPrioritySchema = z.enum(['none', 'low', 'medium', 'high', 'urgent']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

const EntityIdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();

/** Proyecto del espacio personal del usuario. */
export const ProjectSchema = z.object({
  id: EntityIdSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable(),
  status: ProjectStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Project = z.infer<typeof ProjectSchema>;

/** Tarea que puede pertenecer a un proyecto o permanecer en el inbox. */
export const TaskSchema = z.object({
  id: EntityIdSchema,
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10_000).nullable(),
  projectId: EntityIdSchema.nullable(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueDate: z.string().date().nullable(),
  completedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Task = z.infer<typeof TaskSchema>;
