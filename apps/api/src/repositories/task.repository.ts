import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from '@nexo/contracts';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { taskAttachments, taskSequences, tasks, type NewTaskRow, type TaskRow } from '../db/schema.js';
import type { StoredTaskAttachment } from '../services/task-attachment-storage.js';

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
    title: `#${row.ticketNumber} · ${row.title}`,
    notes: row.notes,
    tags: row.tags ?? [],
    projectId: row.projectId,
    status: row.status,
    priority: row.priority,
    pinned: row.pinned,
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
    return db.transaction(async (transaction) => {
      const ticketNumber = await this.nextTicketNumber(transaction, input.projectId ?? null);
      const [task] = await transaction.insert(tasks)
        .values({ ...toTaskDbInput(input), title: input.title, ticketNumber })
        .returning();
      return toTask(task);
    });
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

    return db.transaction(async (transaction) => {
      const [current] = await transaction.select().from(tasks).where(eq(tasks.id, id)).for('update');
      if (!current) return null;
      const projectChanged = input.projectId !== undefined && input.projectId !== current.projectId;
      const ticketNumber = projectChanged
        ? await this.nextTicketNumber(transaction, input.projectId ?? null)
        : current.ticketNumber;
      const [task] = await transaction.update(tasks)
        .set({ ...toTaskDbInput(input), ticketNumber, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      return toTask(task);
    });
  }

  private async nextTicketNumber(transaction: Parameters<Parameters<typeof db.transaction>[0]>[0], projectId: string | null): Promise<number> {
    const scopeKey = projectId ?? 'inbox';
    const [sequence] = await transaction.insert(taskSequences).values({ scopeKey, nextNumber: 1 })
      .onConflictDoUpdate({ target: taskSequences.scopeKey, set: { nextNumber: sql`${taskSequences.nextNumber} + 1` } })
      .returning({ nextNumber: taskSequences.nextNumber });
    return sequence.nextNumber;
  }

  async delete(id: string): Promise<StoredTaskAttachment[] | null> {
    return db.transaction(async (transaction) => {
      const attachments = await transaction
        .select({ storageKey: taskAttachments.storageKey, mimeType: taskAttachments.mimeType })
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, id));
      const deleted = await transaction.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
      return deleted.length ? attachments : null;
    });
  }
}
