import { Hono } from 'hono';
import {
  CreateProjectInputSchema,
  ListProjectsQuerySchema,
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

  return projectsRoute;
}

export const projectsRoute = createProjectsRoute();