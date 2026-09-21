import { HealthRepository } from '../repositories/health.repository.js';

export class HealthService {
  private readonly healthRepository = new HealthRepository();

  getStatus() {
    return this.healthRepository.getStatus();
  }
}
