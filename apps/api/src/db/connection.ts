import { databasePool } from './client.js';

export async function checkDatabaseConnection(): Promise<void> {
  await databasePool.query('SELECT 1');
}
