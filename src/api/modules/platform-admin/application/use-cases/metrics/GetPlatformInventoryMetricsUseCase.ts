import { Injectable } from '@nestjs/common';
import { PlatformInventoryReadDao } from '../../../infrastructure/daos/PlatformInventoryReadDao';

@Injectable()
export class GetPlatformInventoryMetricsUseCase {
  constructor(private readonly dao: PlatformInventoryReadDao) {}

  async execute(input: { tenantId?: string }) {
    return this.dao.getMetrics(input);
  }
}
