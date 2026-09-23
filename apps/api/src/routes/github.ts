import { Hono } from 'hono';
import { listGithubRepositories } from '../services/github.service.js';

export const githubRoute = new Hono();

githubRoute.get('/repositories', async (context) => context.json(await listGithubRepositories()));
