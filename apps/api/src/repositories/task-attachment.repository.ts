import type { TaskAttachment } from '@nexo/contracts';
import { and, asc, eq, isNull, like, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { taskAttachments, tasks, type TaskAttachmentRow } from '../db/schema.js';

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

  async delete(taskId: string, id: string, removeFile: (attachment: TaskAttachmentRow) => Promise<void>): Promise<TaskAttachmentRow | null> {
    return db.transaction(async (transaction) => {
      const [row] = await transaction.select().from(taskAttachments).where(
        and(eq(taskAttachments.taskId, taskId), eq(taskAttachments.id, id)),
      ).for('update');
      if (!row) return null;
      await removeFile(row);
      await transaction.delete(taskAttachments).where(eq(taskAttachments.id, id));
      return row;
    });
  }

  async expiredImages(cutoff: Date): Promise<TaskAttachmentRow[]> {
    const rows = await db.select({ attachment: taskAttachments }).from(taskAttachments)
      .innerJoin(tasks, eq(taskAttachments.taskId, tasks.id))
      .where(and(eq(tasks.status, 'done'), isNull(tasks.deletedAt), lte(tasks.completedAt, cutoff), like(taskAttachments.mimeType, 'image/%')));
    return rows.map(({ attachment }) => attachment);
  }

  async deleteExpiredImage(id: string, cutoff: Date, removeFile: (image: TaskAttachmentRow) => Promise<void>): Promise<void> {
    await db.transaction(async (transaction) => {
      const [row] = await transaction.select({ attachment: taskAttachments }).from(taskAttachments)
        .innerJoin(tasks, eq(taskAttachments.taskId, tasks.id))
        .where(and(eq(taskAttachments.id, id), eq(tasks.status, 'done'), isNull(tasks.deletedAt), lte(tasks.completedAt, cutoff)))
        .for('update');
      if (!row || !row.attachment.mimeType.startsWith('image/')) return;
      await removeFile(row.attachment);
      await transaction.delete(taskAttachments).where(eq(taskAttachments.id, id));
    });
  }
}
