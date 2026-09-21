import { serve } from '@hono/node-server';
import { app } from './app.js';
import { checkDatabaseConnection } from './db/index.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

async function startServer(): Promise<void> {
	await checkDatabaseConnection();
	serve({ fetch: app.fetch, port });
}

startServer().catch((error: unknown) => {
	console.error('Failed to connect to PostgreSQL', error);
	process.exitCode = 1;
});
