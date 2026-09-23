import { Hono } from 'hono';
import { HealthService } from '../services/health.service.js';
import { checkDatabaseConnection } from '../db/index.js';

export const healthRoute = new Hono();
const healthService = new HealthService();

healthRoute.get('/', async (context) => {
  try {
    await checkDatabaseConnection();
    return context.json(healthService.getStatus());
  } catch {
    return context.json({ status: 'unavailable' }, 503);
  }
});
