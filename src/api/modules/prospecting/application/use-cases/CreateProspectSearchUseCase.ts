import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantFacade,
  TENANT_FACADE,
} from '@modules/tenant/application/facades/ITenantFacade';
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
import {
  IProspectingDailyQuotaPort,
  PROSPECTING_DAILY_QUOTA_PORT,
} from '../ports/IProspectingDailyQuotaPort';

@Injectable()
export class CreateProspectSearchUseCase implements ICreateProspectSearchUseCase {
  constructor(
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_QUEUE)
    private readonly searchQueue: IProspectSearchQueue,
    @Inject(PROSPECTING_DAILY_QUOTA_PORT)
    private readonly prospectingQuotaPort: IProspectingDailyQuotaPort,
  ) {}

  async execute(
    input: CreateProspectSearchInput,
  ): Promise<CreateProspectSearchOutput> {
    const exists = await this.tenantFacade.tenantExists(input.tenantId);

    if (!exists) {
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

    await this.prospectingQuotaPort.assertCanConsume({
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
