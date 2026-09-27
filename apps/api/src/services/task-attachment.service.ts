import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import type { TaskAttachment } from '@nexo/contracts';
import { TaskRepository } from '../repositories/task.repository.js';
import { TaskAttachmentRepository } from '../repositories/task-attachment.repository.js';
import { TaskNotFoundError } from './task.service.js';
import { attachmentPath, removeStoredAttachments } from './task-attachment-storage.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']);
const UPLOAD_DIRECTORY = process.env.NEXO_UPLOADS_DIR ?? 'uploads';

export class TaskAttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskAttachmentValidationError';
  }
}

export class TaskAttachmentService {
  constructor(
    private readonly taskRepository = new TaskRepository(),
    private readonly attachmentRepository = new TaskAttachmentRepository(),
  ) {}

  async list(taskId: string): Promise<TaskAttachment[]> {
    await this.requireTask(taskId);
    return this.attachmentRepository.list(taskId);
  }

  async add(taskId: string, file: File): Promise<TaskAttachment> {
    await this.requireTask(taskId);
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.has(mimeType)) {
      throw new TaskAttachmentValidationError('Tipo de archivo no admitido. Usa PNG, JPEG, WebP, PDF o TXT.');
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      throw new TaskAttachmentValidationError('El archivo debe ocupar entre 1 byte y 10 MB.');
    }

    const storageKey = randomUUID();
    const path = attachmentPath({ storageKey, mimeType });
    await mkdir(UPLOAD_DIRECTORY, { recursive: true });
    await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
    try {
      return await this.attachmentRepository.create({
        taskId,
        storageKey,
        fileName: file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'archivo',
        mimeType,
        size: file.size,
      });
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async read(taskId: string, attachmentId: string): Promise<{ metadata: TaskAttachment; content: Buffer }> {
    await this.requireTask(taskId);
    const row = await this.attachmentRepository.find(taskId, attachmentId);
    if (!row) throw new TaskAttachmentValidationError('Archivo adjunto no encontrado.');
    const content = await readFile(attachmentPath(row));
    const { id, taskId: ownerTaskId, fileName, mimeType, size, createdAt } = row;
    return {
      metadata: { id, taskId: ownerTaskId, fileName, mimeType, size, createdAt: createdAt.toISOString() },
      content,
    };
  }

  async remove(taskId: string, attachmentId: string): Promise<void> {
    const row = await this.attachmentRepository.delete(taskId, attachmentId);
    if (!row) throw new TaskAttachmentValidationError('Archivo adjunto no encontrado.');
    await removeStoredAttachments([row]);
  }

  private async requireTask(taskId: string): Promise<void> {
    if (!(await this.taskRepository.findById(taskId))) {
      throw new TaskNotFoundError(taskId);
    }
  }
}
