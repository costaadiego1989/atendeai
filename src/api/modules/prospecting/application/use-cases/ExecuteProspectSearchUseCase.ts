import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectSearchResultRepository';
import {
  IProspectSearchSourceRegistry,
  PROSPECT_SEARCH_SOURCE_REGISTRY,
} from '../../domain/ports/IProspectSearchSourceRegistry';
import { ProspectSearchResult } from '../../domain/entities/ProspectSearchResult';
import {
  IProspectWebsiteEnricher,
  PROSPECT_WEBSITE_ENRICHER,
} from '../../domain/ports/IProspectWebsiteEnricher';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  IRecordUsageUseCase,
  UsageType,
} from '@modules/billing/application/use-cases/interfaces/IRecordUsageUseCase';
import {
  ExecuteProspectSearchInput,
  ExecuteProspectSearchOutput,
  IExecuteProspectSearchUseCase,
} from './interfaces/IExecuteProspectSearchUseCase';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';

@Injectable()
export class ExecuteProspectSearchUseCase
  implements IExecuteProspectSearchUseCase
{
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_RESULT_REPOSITORY)
    private readonly searchResultRepository: IProspectSearchResultRepository,
    @Inject(PROSPECT_SEARCH_SOURCE_REGISTRY)
    private readonly sourceRegistry: IProspectSearchSourceRegistry,
    @Inject(PROSPECT_WEBSITE_ENRICHER)
    private readonly websiteEnricher: IProspectWebsiteEnricher,
    @Inject(ICheckQuotaUseCase)
    private readonly checkQuotaUseCase: ICheckQuotaUseCase,
    @Inject(IRecordUsageUseCase)
    private readonly recordUsageUseCase: IRecordUsageUseCase,
    private readonly prospectingQuotaService: BillingProspectingQuotaService,
  ) {}

  async execute(
    input: ExecuteProspectSearchInput,
  ): Promise<ExecuteProspectSearchOutput> {
    const search = await this.searchRepository.findBySearchId(input.searchId);

    if (!search) {
      throw new EntityNotFoundException('ProspectSearch', input.searchId);
    }

    const quotaCheck = await this.checkQuotaUseCase.execute({
      tenantId: search.tenantId.toString(),
      type: UsageType.AI_TOKEN,
    });

    if (!quotaCheck.canProceed) {
      search.markAsFailed('AI token quota exceeded for prospect search');
      await this.searchRepository.save(search);

      return {
        searchId: search.id.toString(),
        status: 'FAILED',
        discoveredCount: search.discoveredCount,
      };
    }

    try {
      await this.prospectingQuotaService.assertCanConsume({
        tenantId: search.tenantId.toString(),
        requested: search.maxResults,
      });
    } catch (error: any) {
      search.markAsFailed(error?.message || 'Prospecting daily quota exceeded');
      await this.searchRepository.save(search);

      return {
        searchId: search.id.toString(),
        status: 'FAILED',
        discoveredCount: search.discoveredCount,
      };
    }

    const source = this.sourceRegistry.resolve(search.source.value);
    if (!source) {
      throw new ValidationErrorException(
        `Search source ${search.source.value} is not configured`,
      );
    }

    search.markAsRunning();
    await this.searchRepository.save(search);

    try {
      const sourceResults = await source.search({
        businessTypeQuery: search.businessTypeQuery,
        city: search.city,
        state: search.state,
        neighborhood: search.neighborhood,
        maxResults: search.maxResults,
      });

      const results: ProspectSearchResult[] = [];

      for (const item of sourceResults) {
        const enrichment =
          item.website && (!item.email || !item.phone)
            ? await this.tryEnrichWebsite(item.website)
            : {};

        results.push(
          ProspectSearchResult.create({
            tenantId: search.tenantId,
            searchId: search.id,
            source: search.source,
            externalId: item.externalId,
            businessName: item.businessName,
            city: item.city,
            state: item.state,
            phone: item.phone || enrichment.phone,
            whatsappPhone:
              this.normalizeWhatsApp(item.whatsappPhone) ||
              this.normalizeWhatsApp(item.phone) ||
              this.normalizeWhatsApp(enrichment.whatsappPhone) ||
              this.normalizeWhatsApp(enrichment.phone),
            instagramUrl: item.instagramUrl || enrichment.instagramUrl,
            email: item.email || enrichment.email,
            website: item.website,
          }),
        );
      }

      await this.searchResultRepository.saveMany(results);
      await this.recordUsageUseCase.execute({
        tenantId: search.tenantId.toString(),
        type: UsageType.AI_TOKEN,
        amount: this.calculateTokenConsumption(search.maxResults, results.length),
      });

      search.markAsCompleted(results.length);
      await this.searchRepository.save(search);

      return {
        searchId: search.id.toString(),
        status: 'COMPLETED',
        discoveredCount: results.length,
      };
    } catch (error: any) {
      search.markAsFailed(error?.message || 'Unknown search failure');
      await this.searchRepository.save(search);

      return {
        searchId: search.id.toString(),
        status: 'FAILED',
        discoveredCount: search.discoveredCount,
      };
    }
  }

  private async tryEnrichWebsite(website: string): Promise<{
    email?: string;
    phone?: string;
    whatsappPhone?: string;
    instagramUrl?: string;
  }> {
    try {
      return await this.websiteEnricher.enrich({ website });
    } catch {
      return {};
    }
  }

  private normalizeWhatsApp(phone?: string): string | undefined {
    if (!phone?.trim()) {
      return undefined;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return undefined;
    }

    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  private calculateTokenConsumption(
    maxResults: number,
    discoveredCount: number,
  ): number {
    return Math.max(1, Math.min(maxResults, discoveredCount || 1));
  }
}
