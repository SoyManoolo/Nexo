import { Pool } from 'pg';
import { databaseConfig } from './config.js';

export const databasePool = new Pool(databaseConfig);

export async function closeDatabase(): Promise<void> {
  await databasePool.end();
}
