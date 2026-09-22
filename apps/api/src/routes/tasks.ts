import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  CreateTaskInputSchema,
  ListTasksQuerySchema,
  TaskIdParamsSchema,
  UpdateTaskInputSchema,
} from '@nexo/contracts';
import { TaskService } from '../services/task.service.js';

export function createTasksRoute(taskService = new TaskService()): Hono {
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