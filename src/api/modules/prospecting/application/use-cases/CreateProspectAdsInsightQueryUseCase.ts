import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantFacade,
  TENANT_FACADE,
} from '@modules/tenant/application/facades/ITenantFacade';
import { TenantId } from '@shared/domain/TenantId';
import {
  CreateProspectAdsInsightQueryInput,
  CreateProspectAdsInsightQueryOutput,
  ICreateProspectAdsInsightQueryUseCase,
} from './interfaces/ICreateProspectAdsInsightQueryUseCase';
import { ProspectAdsInsightQuery } from '../../domain/entities/ProspectAdsInsightQuery';
import {
  IProspectAdsInsightQueryRepository,
  PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY,
} from '../../domain/repositories/IProspectAdsInsightQueryRepository';
import {
  IProspectAdsInsightResultRepository,
  PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectAdsInsightResultRepository';
import {
  GOOGLE_ADS_INSIGHTS_SOURCE,
  IGoogleAdsInsightsSource,
} from '../../domain/ports/IGoogleAdsInsightsSource';
import { ProspectAdsInsightResult } from '../../domain/entities/ProspectAdsInsightResult';

@Injectable()
export class CreateProspectAdsInsightQueryUseCase implements ICreateProspectAdsInsightQueryUseCase {
  constructor(
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY)
    private readonly queryRepository: IProspectAdsInsightQueryRepository,
    @Inject(PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY)
    private readonly resultRepository: IProspectAdsInsightResultRepository,
    @Inject(GOOGLE_ADS_INSIGHTS_SOURCE)
    private readonly insightsSource: IGoogleAdsInsightsSource,
  ) {}

  async execute(
    input: CreateProspectAdsInsightQueryInput,
  ): Promise<CreateProspectAdsInsightQueryOutput> {
    const exists = await this.tenantFacade.tenantExists(input.tenantId);
    if (!exists) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const query = ProspectAdsInsightQuery.create({
      tenantId: TenantId.create(input.tenantId),
      segment: input.segment,
      city: input.city,
      state: input.state,
      country: input.country || 'BR',
      ageRange: input.ageRange,
      gender: input.gender,
      interest: input.interest,
    });

    await this.queryRepository.save(query);
    query.markAsRunning();
    await this.queryRepository.save(query);

    try {
      const insights = await this.insightsSource.generateInsights({
        tenantId: input.tenantId,
        segment: query.segment,
        city: query.city,
        state: query.state,
        country: query.country,
        ageRange: query.ageRange,
        gender: query.gender,
        interest: query.interest,
      });

      const results = insights.map((item) =>
        ProspectAdsInsightResult.create({
          tenantId: query.tenantId,
          queryId: query.id,
          resultType: item.resultType,
          title: item.title,
          subtitle: item.subtitle,
          metricValue: item.metricValue,
          score: item.score,
          metadata: item.metadata,
        }),
      );

      await this.resultRepository.deleteByQuery(
        query.tenantId.toString(),
        query.id.toString(),
      );
      await this.resultRepository.saveMany(results);
      query.markAsCompleted(results.length);
      await this.queryRepository.save(query);
    } catch (error: any) {
      query.markAsFailed(
        error?.message || 'Failed to fetch Google Ads insights',
      );
      await this.queryRepository.save(query);
      throw error;
    }

    return {
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
    };
  }
}
