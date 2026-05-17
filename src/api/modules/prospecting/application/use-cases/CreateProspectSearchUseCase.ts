import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectSearch } from '../../domain/entities/ProspectSearch';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import { ProspectSearchSourceVO } from '../../domain/value-objects/ProspectSearchSource';
import {
  IProspectSearchQueue,
  PROSPECT_SEARCH_QUEUE,
} from '../../domain/ports/IProspectSearchQueue';
import {
  CreateProspectSearchInput,
  CreateProspectSearchOutput,
  ICreateProspectSearchUseCase,
} from './interfaces/ICreateProspectSearchUseCase';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';

@Injectable()
export class CreateProspectSearchUseCase implements ICreateProspectSearchUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_QUEUE)
    private readonly searchQueue: IProspectSearchQueue,
    private readonly prospectingQuotaService: BillingProspectingQuotaService,
  ) {}

  async execute(
    input: CreateProspectSearchInput,
  ): Promise<CreateProspectSearchOutput> {
    const tenant = await this.tenantRepository.findById(input.tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const search = ProspectSearch.create({
      tenantId: TenantId.create(input.tenantId),
      businessTypeQuery: input.businessTypeQuery,
      city: input.city,
      state: input.state,
      neighborhood: input.neighborhood,
      source: ProspectSearchSourceVO.create(input.source ?? 'GOOGLE_PLACES'),
      maxResults: input.maxResults,
    });

    await this.prospectingQuotaService.assertCanConsume({
      tenantId: input.tenantId,
      requested: search.maxResults,
    });

    await this.searchRepository.save(search);
    await this.searchQueue.addJob({
      searchId: search.id.toString(),
    });

    return {
      id: search.id.toString(),
      tenantId: search.tenantId.toString(),
      businessTypeQuery: search.businessTypeQuery,
      city: search.city,
      state: search.state,
      neighborhood: search.neighborhood,
      source: search.source.value,
      maxResults: search.maxResults,
      status: search.status.value,
      discoveredCount: search.discoveredCount,
      failureReason: search.failureReason,
      createdAt: search.createdAt,
    };
  }
}
