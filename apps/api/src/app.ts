import { Hono } from 'hono';
import { handleApiError } from './http/error-handler.js';
import { healthRoute } from './routes/health.js';
import { createProjectsRoute } from './routes/projects.js';
import { createTasksRoute } from './routes/tasks.js';
import type { ProjectService } from './services/project.service.js';
import type { TaskService } from './services/task.service.js';

export function createApp(projectService?: ProjectService, taskService?: TaskService) {
	const app = new Hono();

	app.onError(handleApiError);

	app.route('/health', healthRoute);
	app.route('/projects', createProjectsRoute(projectService));
	app.route('/tasks', createTasksRoute(taskService));

	return app;
}

export const app = createApp();
