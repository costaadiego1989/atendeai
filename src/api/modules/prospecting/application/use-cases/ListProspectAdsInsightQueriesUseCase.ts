import { Inject, Injectable } from '@nestjs/common';
import {
  IListProspectAdsInsightQueriesUseCase,
  ListProspectAdsInsightQueriesInput,
  ProspectAdsInsightQueryListItem,
} from './interfaces/IListProspectAdsInsightQueriesUseCase';
import {
  IProspectAdsInsightQueryRepository,
  PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY,
} from '../../domain/repositories/IProspectAdsInsightQueryRepository';

@Injectable()
export class ListProspectAdsInsightQueriesUseCase
  implements IListProspectAdsInsightQueriesUseCase
{
  constructor(
    @Inject(PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY)
    private readonly queryRepository: IProspectAdsInsightQueryRepository,
  ) {}

  async execute(
    input: ListProspectAdsInsightQueriesInput,
  ): Promise<ProspectAdsInsightQueryListItem[]> {
    const queries = await this.queryRepository.findAllByTenant(input.tenantId);
    return queries.map((query) => ({
      id: query.id.toString(),
      tenantId: query.tenantId.toString(),
      source: 'GOOGLE_ADS_AUDIENCE',
      segment: query.segment,
      city: query.city,
      state: query.state,
      country: query.country,
      ageRange: query.ageRange,
      gender: query.gender,
      interest: query.interest,
      status: query.status.value,
      discoveredCount: query.discoveredCount,
      failureReason: query.failureReason,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
    }));
  }
}
