import { Injectable } from '@nestjs/common';
import { PlatformCatalogReadDao } from '../../../infrastructure/daos/PlatformCatalogReadDao';

@Injectable()
export class GetPlatformCatalogMetricsUseCase {
  constructor(private readonly dao: PlatformCatalogReadDao) {}

  async execute(input: { tenantId?: string }) {
    return this.dao.getMetrics(input);
  }
}
