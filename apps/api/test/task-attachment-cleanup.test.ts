import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TaskAttachmentRow } from '../src/db/schema.js';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';
const { TaskAttachmentRepository } = await import('../src/repositories/task-attachment.repository.js');
const { cleanupExpiredTaskImages } = await import('../src/services/task-attachment-cleanup.js');
const { attachmentPath } = await import('../src/services/task-attachment-storage.js');

test('removes images of tasks completed over seven days ago', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-cleanup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const image: TaskAttachmentRow = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    taskId: '550e8400-e29b-41d4-a716-446655440011',
    fileName: 'old.png', mimeType: 'image/png', size: 3,
    storageKey: '550e8400-e29b-41d4-a716-446655440012',
    createdAt: new Date('2026-09-01T00:00:00Z'),
  };
  const path = attachmentPath(image, directory);
  await writeFile(path, 'old');
  let removed = false;
  class Repository extends TaskAttachmentRepository {
    override async expiredImages(cutoff: Date) {
      assert.equal(cutoff.toISOString(), '2026-09-21T00:00:00.000Z');
      return [image];
    }
    override async deleteExpiredImage(id: string, _cutoff: Date, removeFile: (item: TaskAttachmentRow) => Promise<void>) {
      assert.equal(id, image.id);
      await removeFile(image);
      removed = true;
    }
  }
  await cleanupExpiredTaskImages(new Repository(), new Date('2026-09-28T00:00:00Z'), directory);
  assert.equal(removed, true);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
});
