import { drizzle } from 'drizzle-orm/node-postgres';
import { databasePool } from './client.js';

export const db = drizzle(databasePool);
