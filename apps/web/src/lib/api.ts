import { NexoApiClient } from '@nexo/api-client';

export function createApiClient(): NexoApiClient {
  const baseUrl = process.env.API_BASE_URL ?? import.meta.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error('API_BASE_URL no está configurada en el servidor web.');
  }

  return new NexoApiClient({ baseUrl });
}
