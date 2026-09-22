import { Hono } from 'hono';
import { handleApiError } from './http/error-handler.js';
import { healthRoute } from './routes/health.js';
import { createProjectsRoute } from './routes/projects.js';
import type { ProjectService } from './services/project.service.js';

export function createApp(projectService?: ProjectService) {
	const app = new Hono();

	app.onError(handleApiError);

	app.route('/health', healthRoute);
	app.route('/projects', createProjectsRoute(projectService));

	return app;
}

export const app = createApp();
