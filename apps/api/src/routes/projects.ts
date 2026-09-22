import { Hono } from 'hono';
import {
  CreateProjectInputSchema,
  ListProjectsQuerySchema,
  ProjectIdParamsSchema,
  UpdateProjectInputSchema,
} from '@nexo/contracts';
import { ProjectService } from '../services/project.service.js';

export function createProjectsRoute(projectService = new ProjectService()): Hono {
  const projectsRoute = new Hono();

  projectsRoute.post('/', async (context) => {
    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json(
        { error: 'validation_error', message: 'Request body must be valid JSON' },
        400,
      );
    }

    const input = CreateProjectInputSchema.safeParse(body);

    if (!input.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project data' }, 400);
    }

    const project = await projectService.create(input.data);
    return context.json(project, 201);
  });

  projectsRoute.get('/', async (context) => {
    const query = ListProjectsQuerySchema.safeParse(context.req.query());

    if (!query.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project filter' }, 400);
    }

    const projects = await projectService.list(query.data);
    return context.json(projects);
  });

  projectsRoute.get('/:id', async (context) => {
    const params = ProjectIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project ID' }, 400);
    }

    const project = await projectService.get(params.data.id);
    return context.json(project);
  });

  projectsRoute.patch('/:id', async (context) => {
    const params = ProjectIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project ID' }, 400);
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

    const input = UpdateProjectInputSchema.safeParse(body);

    if (!input.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project data' }, 400);
    }

    const project = await projectService.update(params.data.id, input.data);
    return context.json(project);
  });

  projectsRoute.post('/:id/archive', async (context) => {
    const params = ProjectIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project ID' }, 400);
    }

    const project = await projectService.archive(params.data.id);
    return context.json(project);
  });

  projectsRoute.delete('/:id', async (context) => {
    const params = ProjectIdParamsSchema.safeParse(context.req.param());

    if (!params.success) {
      return context.json({ error: 'validation_error', message: 'Invalid project ID' }, 400);
    }

    await projectService.delete(params.data.id);
    return context.body(null, 204);
  });

  return projectsRoute;
}

export const projectsRoute = createProjectsRoute();
