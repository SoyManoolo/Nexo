import { HealthResponseSchema, type HealthResponse } from '@nexo/contracts';

export class NexoApiClient {
  constructor(private readonly baseUrl: string) {}

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(new URL('/health', this.baseUrl));

    if (!response.ok) {
      throw new Error(`La API de Nexo respondió con ${response.status}.`);
    }

    return HealthResponseSchema.parse(await response.json());
  }
}
