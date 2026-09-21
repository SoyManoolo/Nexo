import { Hono } from 'hono';
import { HealthService } from '../services/health.service.js';

export const healthRoute = new Hono();
const healthService = new HealthService();

healthRoute.get('/', (context) => context.json(healthService.getStatus()));
