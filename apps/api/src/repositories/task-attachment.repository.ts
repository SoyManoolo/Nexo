import type { TaskAttachment } from '@nexo/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { taskAttachments, type TaskAttachmentRow } from '../db/schema.js';

function toAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    taskId: row.taskId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}

export class TaskAttachmentRepository {
  async create(input: Omit<TaskAttachmentRow, 'id' | 'createdAt'>): Promise<TaskAttachment> {
    const [row] = await db.insert(taskAttachments).values(input).returning();
    return toAttachment(row);
  }

  async list(taskId: string): Promise<TaskAttachment[]> {
    const rows = await db.select().from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(asc(taskAttachments.createdAt), asc(taskAttachments.id));
    return rows.map(toAttachment);
  }

  async find(taskId: string, id: string): Promise<TaskAttachmentRow | null> {
    const [row] = await db.select().from(taskAttachments).where(
      and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.id, id)),
    );
    return row ?? null;
  }

  async delete(taskId: string, id: string): Promise<TaskAttachmentRow | null> {
    const [row] = await db.delete(taskAttachments).where(
      and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.id, id)),
    ).returning();
    return row ?? null;
  }
}
