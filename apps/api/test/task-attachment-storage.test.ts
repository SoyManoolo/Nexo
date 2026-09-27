import assert from 'node:assert/strict';
import { mkdtemp, readFile, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { attachmentPath, removeStoredAttachments } from '../src/services/task-attachment-storage.js';

test('removes stored files after task deletion and tolerates already missing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-task-delete-'));
  const attachment = { storageKey: '550e8400-e29b-41d4-a716-446655440001', mimeType: 'image/png' };
  const path = attachmentPath(attachment, directory);
  try {
    await writeFile(path, 'image');
    assert.equal(await readFile(path, 'utf8'), 'image');
    await removeStoredAttachments([attachment], directory);
    await assert.rejects(readFile(path), { code: 'ENOENT' });
    await removeStoredAttachments([attachment], directory);
  } finally {
    await rmdir(directory);
  }
});
