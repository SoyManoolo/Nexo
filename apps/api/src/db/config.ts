const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to connect to PostgreSQL');
}

export const databaseConfig = {
  connectionString: databaseUrl,
  max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
};