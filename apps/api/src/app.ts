import { Hono } from 'hono';
import { handleApiError } from './http/error-handler.js';
import { healthRoute } from './routes/health.js';

export const app = new Hono();

app.onError(handleApiError);

app.route('/health', healthRoute);
