import type { HealthResponse } from '@nexo/contracts';

/** Repository temporal; el resto de repositories consultarán SQLite mediante db/. */
export class HealthRepository {
  getStatus(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
