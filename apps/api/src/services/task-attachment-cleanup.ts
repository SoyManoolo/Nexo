import { unlink } from 'node:fs/promises';
import { TaskAttachmentRepository } from '../repositories/task-attachment.repository.js';
import { attachmentPath } from './task-attachment-storage.js';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupExpiredTaskImages(
  repository = new TaskAttachmentRepository(),
  now = new Date(),
  directory = process.env.NEXO_UPLOADS_DIR ?? 'uploads',
): Promise<void> {
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  for (const image of await repository.expiredImages(cutoff)) {
    try {
      await repository.deleteExpiredImage(image.id, cutoff, async (current) => {
        try { await unlink(attachmentPath(current, directory)); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      });
    } catch (error) {
      console.error('No se pudo limpiar la imagen de la tarea:', error);
    }
  }
}
