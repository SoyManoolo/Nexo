import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import type { Task, TaskAttachment } from '@nexo/contracts';

process.env.DATABASE_URL ??= 'postgres://nexo:nexo@localhost:5432/nexo';

const { TaskRepository } = await import('../src/repositories/task.repository.js');
const { TaskAttachmentRepository } = await import('../src/repositories/task-attachment.repository.js');
const { TaskAttachmentService, TaskAttachmentValidationError } = await import('../src/services/task-attachment.service.js');
const { attachmentPath } = await import('../src/services/task-attachment-storage.js');
const { optimizeTaskImage } = await import('../src/services/task-image-optimization.js');

const TASK_ID = '550e8400-e29b-41d4-a716-446655440001';

class ExistingTaskRepository extends TaskRepository {
  override async findById(): Promise<Task> {
    return { id: TASK_ID } as Task;
  }
}

class RecordingAttachmentRepository extends TaskAttachmentRepository {
  stored: { storageKey: string; mimeType: string; size: number; fileName: string } | null = null;

  override async create(input: Parameters<TaskAttachmentRepository['create']>[0]): Promise<TaskAttachment> {
    this.stored = input;
    return {
      id: '550e8400-e29b-41d4-a716-446655440002',
      taskId: input.taskId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      createdAt: new Date().toISOString(),
    };
  }
}

test('compresses a photographic PNG before storage and records the stored format and size', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-image-'));
  try {
    const pixels = randomBytes(1200 * 800 * 3);
    const original = await sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } }).png().toBuffer();
    const repository = new RecordingAttachmentRepository();
    const service = new TaskAttachmentService(new ExistingTaskRepository(), repository, directory);

    const attachment = await service.add(TASK_ID, new File([original], 'photo.png', { type: 'image/png' }));
    assert.equal(attachment.mimeType, 'image/webp');
    assert.equal(attachment.fileName, 'photo.webp');
    assert.ok(attachment.size < original.length);
    assert.ok(repository.stored);
    const stored = await readFile(attachmentPath(repository.stored, directory));
    assert.equal(stored.length, attachment.size);
    assert.equal((await sharp(stored).metadata()).format, 'webp');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps the original when conversion cannot save space and leaves non-images untouched', async () => {
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } })
    .webp({ quality: 80, effort: 6 }).toBuffer();
  const optimized = await optimizeTaskImage(tiny, 'image/webp');
  assert.equal(optimized.mimeType, 'image/webp');
  assert.deepEqual(optimized.content, tiny);

  const document = Buffer.from('hello');
  assert.deepEqual(await optimizeTaskImage(document, 'text/plain'), { content: document, mimeType: 'text/plain' });
});

test('limits oversized image dimensions while reducing the stored bytes', async () => {
  const pixels = randomBytes(3000 * 1000 * 3);
  const jpeg = await sharp(pixels, { raw: { width: 3000, height: 1000, channels: 3 } })
    .jpeg({ quality: 95 }).toBuffer();
  const result = await optimizeTaskImage(jpeg, 'image/jpeg');
  const metadata = await sharp(result.content).metadata();
  assert.equal(result.mimeType, 'image/webp');
  assert.equal(metadata.width, 2560);
  assert.ok(result.content.length < jpeg.length);
});

test('rejects invalid images and mismatched declared MIME types before writing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-image-invalid-'));
  try {
    const service = new TaskAttachmentService(new ExistingTaskRepository(), new RecordingAttachmentRepository(), directory);
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
    await assert.rejects(service.add(TASK_ID, new File([jpeg], 'wrong.png', { type: 'image/png' })), TaskAttachmentValidationError);
    await assert.rejects(service.add(TASK_ID, new File([Buffer.from('not an image')], 'bad.png', { type: 'image/png' })), TaskAttachmentValidationError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
