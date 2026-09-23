import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import {
  CreateTaskInputSchema,
  ListTasksQuerySchema,
  TaskIdParamsSchema,
  UpdateTaskInputSchema,
} from '@nexo/contracts';
import { TaskService } from '../services/task.service.js';
import { TaskAttachmentService } from '../services/task-attachment.service.js';

export function createTasksRoute(
  taskService = new TaskService(),
  attachmentService = new TaskAttachmentService(),
): Hono {
  const tasksRoute = new Hono();

  tasksRoute.post('/', async (context) => {
    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json(
        { error: 'validation_error', message: 'Request body must be valid JSON' },
        400,
      );
    }

    const input = CreateTaskInputSchema.safeParse(body);

    if (!input.success) {
      return context.json({ error: 'validation_error', message: 'Invalid task data' }, 400);
    }

    const task = await taskService.create(input.data);
    return context.json(task, 201);
  });

  tasksRoute.get('/', async (context) => {
    const query = ListTasksQuerySchema.safeParse(context.req.query());

    if (!query.success) {
      return context.json({ error: 'validation_error', message: 'Invalid task filter' }, 400);
    }

    const tasks = await taskService.list(query.data);
    return context.json(tasks);
  });

  tasksRoute.get('/:id', async (context) => {
    const params = TaskIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid task ID' }, 400);
    }

    const task = await taskService.get(params.data.id);
    return context.json(task);
  });

  tasksRoute.patch('/:id', async (context) => {
    const params = TaskIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid task ID' }, 400);
    }

    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json(
        { error: 'validation_error', message: 'Request body must be valid JSON' },
        400,
      );
    }

    const input = UpdateTaskInputSchema.safeParse(body);

    if (!input.success) {
      return context.json({ error: 'validation_error', message: 'Invalid task data' }, 400);
    }

    const task = await taskService.update(params.data.id, input.data);
    return context.json(task);
  });

  tasksRoute.post('/:id/complete', async (context) => {
    return runTaskAction(context, (id) => taskService.complete(id));
  });

  tasksRoute.post('/:id/reopen', async (context) => {
    return runTaskAction(context, (id) => taskService.reopen(id));
  });

  tasksRoute.post('/:id/move-to-inbox', async (context) => {
    return runTaskAction(context, (id) => taskService.moveToInbox(id));
  });

  tasksRoute.get('/:id/attachments', async (context) => {
    const params = TaskIdParamsSchema.safeParse(context.req.param());
    if (!params.success) return context.json({ error: 'validation_error', message: 'Invalid task ID' }, 400);
    return context.json(await attachmentService.list(params.data.id));
  });

  tasksRoute.post('/:id/attachments', async (context) => {
    const params = TaskIdParamsSchema.safeParse(context.req.param());
    if (!params.success) return context.json({ error: 'validation_error', message: 'Invalid task ID' }, 400);
    const contentLength = Number(context.req.header('content-length') ?? 0);
    if (contentLength > 11 * 1024 * 1024) {
      return context.json({ error: 'validation_error', message: 'El archivo no puede superar 10 MB.' }, 400);
    }
    let form: FormData;
    try { form = await context.req.formData(); }
    catch { return context.json({ error: 'validation_error', message: 'El formulario de archivo no es válido.' }, 400); }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return context.json({ error: 'validation_error', message: 'Selecciona un archivo.' }, 400);
    }
    const attachment = await attachmentService.add(params.data.id, file);
    return context.json(attachment, 201);
  });

  tasksRoute.get('/:id/attachments/:attachmentId', async (context) => {
    const params = TaskIdParamsSchema.safeParse({ id: context.req.param('id') });
    const attachmentId = context.req.param('attachmentId');
    if (!params.success || !z.string().uuid().safeParse(attachmentId).success) {
      return context.json({ error: 'validation_error', message: 'Invalid attachment ID' }, 400);
    }
    const { metadata, content } = await attachmentService.read(params.data.id, attachmentId);
    return new Response(new Uint8Array(content), {
      headers: {
        'content-type': metadata.mimeType,
        'content-length': String(metadata.size),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.fileName)}`,
        'x-content-type-options': 'nosniff',
      },
    });
  });

  tasksRoute.delete('/:id/attachments/:attachmentId', async (context) => {
    const params = TaskIdParamsSchema.safeParse({ id: context.req.param('id') });
    const attachmentId = context.req.param('attachmentId');
    if (!params.success || !z.string().uuid().safeParse(attachmentId).success) {
      return context.json({ error: 'validation_error', message: 'Invalid attachment ID' }, 400);
    }
    await attachmentService.remove(params.data.id, attachmentId);
    return context.body(null, 204);
  });

  return tasksRoute;
}

async function runTaskAction(
  context: Context,
  action: (id: string) => Promise<unknown>,
) {
  const params = TaskIdParamsSchema.safeParse(context.req.param());

  if (!params.success) {
    return context.json({ error: 'validation_error', message: 'Invalid task ID' }, 400);
  }

  const task = await action(params.data.id);
  return context.json(task);
}

export const tasksRoute = createTasksRoute();
