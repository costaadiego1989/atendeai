import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceAbandonmentConfigRecord,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { UpdateCommerceAbandonmentConfigDTO } from '../../presentation/dtos/CommerceDTOs';

@Injectable()
export class UpdateAbandonmentConfigUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(
    tenantId: string,
    input: UpdateCommerceAbandonmentConfigDTO,
  ): Promise<CommerceAbandonmentConfigRecord> {
    return this.commerceRepository.upsertAbandonmentConfig({
      tenantId,
      ...input,
    });
  }
}
