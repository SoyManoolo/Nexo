import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from '@nexo/contracts';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks, type NewTaskRow, type TaskRow } from '../db/schema.js';

function toTaskDbInput(input: CreateTaskInput | UpdateTaskInput): Partial<NewTaskRow> {
  const { dueAt, startedAt, completedAt, ...rest } = input;

  return {
    ...rest,
    dueAt: dueAt === undefined ? undefined : dueAt ? new Date(dueAt) : null,
    startedAt: startedAt === undefined ? undefined : startedAt ? new Date(startedAt) : null,
    completedAt:
      completedAt === undefined ? undefined : completedAt ? new Date(completedAt) : null,
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    projectId: row.projectId,
    status: row.status,
    priority: row.priority,
    scheduledFor: row.scheduledFor,
    dueAt: row.dueAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    blockedReason: row.blockedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class TaskRepository {
  async create(input: CreateTaskInput): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values({ ...toTaskDbInput(input), title: input.title })
      .returning();
    return toTask(task);
  }

  async list(options: ListTasksQuery = {}): Promise<Task[]> {
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(
          options.projectId ? eq(tasks.projectId, options.projectId) : undefined,
          options.status ? eq(tasks.status, options.status) : undefined,
          options.priority ? eq(tasks.priority, options.priority) : undefined,
          options.scheduledFor ? eq(tasks.scheduledFor, options.scheduledFor) : undefined,
          options.dueAt ? eq(tasks.dueAt, new Date(options.dueAt)) : undefined,
        ),
      )
      .orderBy(
        sql`CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END`,
        sql`${tasks.scheduledFor} ASC NULLS LAST`,
        sql`${tasks.dueAt} ASC NULLS LAST`,
        desc(tasks.updatedAt),
        desc(tasks.id),
      );

    return rows.map(toTask);
  }

  async findById(id: string): Promise<Task | null> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task ? toTask(task) : null;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    const [task] = await db
      .update(tasks)
      .set({ ...toTaskDbInput(input), updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    return task ? toTask(task) : null;
  }
}