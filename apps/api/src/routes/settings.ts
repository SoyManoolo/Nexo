import { Hono } from 'hono';
import { z } from 'zod';
import { githubConnectionStatus, removeGithubToken, saveGithubToken } from '../services/github.service.js';

export const settingsRoute = new Hono();

settingsRoute.get('/github', async (context) => context.json(await githubConnectionStatus()));

settingsRoute.put('/github', async (context) => {
  let body: unknown;
  try { body = await context.req.json(); } catch {
    return context.json({ error: 'validation_error', message: 'Request body must be valid JSON' }, 400);
  }
  const parsed = z.object({ token: z.string().trim().min(1).max(500) }).strict().safeParse(body);
  if (!parsed.success) return context.json({ error: 'validation_error', message: 'Introduce un token de GitHub válido' }, 400);
  await saveGithubToken(parsed.data.token);
  return context.json({ connected: true });
});

settingsRoute.delete('/github', async (context) => {
  await removeGithubToken();
  return context.json({ connected: false });
});
