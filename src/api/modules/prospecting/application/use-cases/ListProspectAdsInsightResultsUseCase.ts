import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IListProspectAdsInsightResultsUseCase,
  ListProspectAdsInsightResultsInput,
  ProspectAdsInsightResultListItem,
} from './interfaces/IListProspectAdsInsightResultsUseCase';
import {
  IProspectAdsInsightQueryRepository,
  PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY,
} from '../../domain/repositories/IProspectAdsInsightQueryRepository';
import {
  IProspectAdsInsightResultRepository,
  PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectAdsInsightResultRepository';

@Injectable()
export class ListProspectAdsInsightResultsUseCase implements IListProspectAdsInsightResultsUseCase {
  constructor(
    @Inject(PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY)
    private readonly queryRepository: IProspectAdsInsightQueryRepository,
    @Inject(PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY)
    private readonly resultRepository: IProspectAdsInsightResultRepository,
  ) {}

  async execute(
    input: ListProspectAdsInsightResultsInput,
  ): Promise<ProspectAdsInsightResultListItem[]> {
    const query = await this.queryRepository.findById(
      input.tenantId,
      input.queryId,
    );
    if (!query) {
      throw new EntityNotFoundException(
        'ProspectAdsInsightQuery',
        input.queryId,
      );
    }

    const results = await this.resultRepository.findAllByQuery(
      input.tenantId,
      input.queryId,
    );

    return results.map((result) => ({
      id: result.id.toString(),
      queryId: result.queryId.toString(),
      resultType: result.resultType,
      title: result.title,
      subtitle: result.subtitle,
      metricValue: result.metricValue,
      score: result.score,
      metadata: result.metadata,
      createdAt: result.createdAt,
    }));
  }
}
