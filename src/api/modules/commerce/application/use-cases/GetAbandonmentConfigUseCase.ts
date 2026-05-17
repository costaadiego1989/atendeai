import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceAbandonmentConfigRecord,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

@Injectable()
export class GetAbandonmentConfigUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(tenantId: string): Promise<CommerceAbandonmentConfigRecord> {
    const config =
      await this.commerceRepository.findAbandonmentConfigByTenantId(tenantId);
    if (!config) {
      // Return default config if not found
      return {
        id: 'default',
        tenantId,
        active: true,
        message: null,
        useAiMessage: true,
        mode: 'SINGLE',
        maxTouches: 1,
        intervalMinutes: 60,
        minimumIntervalMinutes: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return config;
  }
}
