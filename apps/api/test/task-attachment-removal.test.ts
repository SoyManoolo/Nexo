import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Task } from '@nexo/contracts';
import type { TaskAttachmentRow } from '../src/db/schema.js';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';

const { TaskRepository } = await import('../src/repositories/task.repository.js');
const { TaskAttachmentRepository } = await import('../src/repositories/task-attachment.repository.js');
const { TaskAttachmentService } = await import('../src/services/task-attachment.service.js');
const { attachmentPath } = await import('../src/services/task-attachment-storage.js');

const taskId = '550e8400-e29b-41d4-a716-446655440001';
const attachmentId = '550e8400-e29b-41d4-a716-446655440002';

test('keeps an attachment reachable after unlink fails and removes it on retry', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-attachment-removal-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const row: TaskAttachmentRow = {
    id: attachmentId,
    taskId,
    storageKey: '550e8400-e29b-41d4-a716-446655440003',
    fileName: 'image.png',
    mimeType: 'image/png',
    size: 5,
    createdAt: new Date(),
  };
  const path = attachmentPath(row, directory);
  await mkdir(path); // unlink of a directory fails even when running as root.

  class ExistingTaskRepository extends TaskRepository {
    override async findById(): Promise<Task> {
      return { id: taskId } as Task;
    }
  }
  class RecordingAttachmentRepository extends TaskAttachmentRepository {
    current: TaskAttachmentRow | null = row;

    override async delete(
      ownerTaskId: string,
      id: string,
      removeFile: (attachment: TaskAttachmentRow) => Promise<void>,
    ): Promise<TaskAttachmentRow | null> {
      assert.equal(ownerTaskId, taskId);
      assert.equal(id, attachmentId);
      if (!this.current) return null;
      await removeFile(this.current);
      const removed = this.current;
      this.current = null;
      return removed;
    }
  }

  const repository = new RecordingAttachmentRepository();
  const service = new TaskAttachmentService(new ExistingTaskRepository(), repository, directory);
  await assert.rejects(service.remove(taskId, attachmentId), { code: 'EISDIR' });
  assert.equal(repository.current, row);

  await rmdir(path);
  await writeFile(path, 'image');
  await service.remove(taskId, attachmentId);
  assert.equal(repository.current, null);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
});
