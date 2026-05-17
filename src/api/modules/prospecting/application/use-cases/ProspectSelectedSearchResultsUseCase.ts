import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { ProspectAudienceTypeVO } from '../../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../../domain/value-objects/ProspectChannel';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectSearchResultRepository';
import { ProspectSearchResult } from '../../domain/entities/ProspectSearchResult';
import { ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX } from '../services/ProspectDispatchPolicy';
import { ProspectDispatchPolicy } from '../services/ProspectDispatchPolicy';
import {
  IProspectSelectedSearchResultsUseCase,
  ProspectSelectedSearchResultsInput,
  ProspectSelectedSearchResultsOutput,
} from './interfaces/IProspectSelectedSearchResultsUseCase';

@Injectable()
export class ProspectSelectedSearchResultsUseCase implements IProspectSelectedSearchResultsUseCase {
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_RESULT_REPOSITORY)
    private readonly searchResultRepository: IProspectSearchResultRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    private readonly dispatchPolicy: ProspectDispatchPolicy,
  ) {}

  async execute(
    input: ProspectSelectedSearchResultsInput,
  ): Promise<ProspectSelectedSearchResultsOutput> {
    if (!input.messageTemplate?.trim()) {
      throw new ValidationErrorException(
        'Prospect message template is required',
      );
    }
    this.dispatchPolicy.assertTemplateSupportsPersonalization(
      input.messageTemplate,
    );

    const search = await this.searchRepository.findById(
      input.tenantId,
      input.searchId,
    );

    if (!search) {
      throw new EntityNotFoundException('ProspectSearch', input.searchId);
    }

    const results = await this.searchResultRepository.findAllBySearch(
      input.tenantId,
      input.searchId,
    );
    const selectedResults = this.selectResults(results, input.resultIds);

    const targetContactIds: string[] = [];
    let importedCount = 0;
    let reusedExistingContacts = 0;
    let skippedMissingPhone = 0;

    for (const result of selectedResults) {
      const normalizedPhone =
        input.channel === 'INSTAGRAM'
          ? this.normalizePhone(result.phone || result.whatsappPhone)
          : this.normalizePhone(result.whatsappPhone || result.phone);

      const hasCompatibleChannel =
        input.channel === 'INSTAGRAM'
          ? !!result.instagramUrl
          : !!this.normalizePhone(result.whatsappPhone || result.phone);

      if (!hasCompatibleChannel) {
        skippedMissingPhone += 1;
        continue;
      }

      if (!normalizedPhone) {
        skippedMissingPhone += 1;
        continue;
      }

      const upsertResult = await this.contactFacade.upsertProspectContact({
        tenantId: input.tenantId,
        name: result.businessName,
        phone: normalizedPhone,
        email: result.email,
        notes: this.buildNotes(result.website, result.city, result.state),
        tags: [
          'prospecting',
          `source:${result.source.value.toLowerCase()}`,
          'temperature:cold',
        ],
      });

      if (!upsertResult.created) {
        reusedExistingContacts += 1;
        targetContactIds.push(upsertResult.contactId);
        continue;
      }
      importedCount += 1;
      targetContactIds.push(upsertResult.contactId);
    }

    const uniqueTargetContactIds = [...new Set(targetContactIds)];
    if (uniqueTargetContactIds.length === 0) {
      throw new ValidationErrorException(
        'Selected results did not produce any actionable contacts',
      );
    }

    const campaign = ProspectCampaign.create({
      tenantId: search.tenantId,
      name: input.campaignName?.trim() || this.buildCampaignName(search),
      objective:
        input.dispatchMode === 'DIRECT_FIRST_MESSAGE'
          ? this.buildDirectDispatchObjective(input.objective, search)
          : this.buildAssistedQueueObjective(input.objective, search),
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create(input.channel),
      targetContactIds: uniqueTargetContactIds,
      messageTemplate: input.messageTemplate.trim(),
      dailyLimit: uniqueTargetContactIds.length,
    });

    await this.campaignRepository.save(campaign);

    return {
      searchId: search.id.toString(),
      campaignId: campaign.id.toString(),
      importedCount,
      reusedExistingContacts,
      skippedMissingPhone,
      dispatchedExecutions: 0,
      targetContactIds: uniqueTargetContactIds,
    };
  }

  private selectResults(
    results: ProspectSearchResult[],
    resultIds: string[],
  ): ProspectSearchResult[] {
    const selectedIds = new Set(resultIds);
    const selectedResults = results.filter((result) =>
      selectedIds.has(result.id.toString()),
    );

    if (selectedResults.length === 0) {
      throw new ValidationErrorException(
        'No selected prospect search results were found',
      );
    }

    return selectedResults;
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone?.trim()) {
      return undefined;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return undefined;
    }

    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  private buildNotes(
    website?: string,
    city?: string,
    state?: string,
  ): string | undefined {
    const parts = [
      'Importado da captação automatizada',
      city ? `Cidade: ${city}${state ? `/${state}` : ''}` : undefined,
      website ? `Website: ${website}` : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : undefined;
  }

  private buildCampaignName(search: {
    businessTypeQuery: string;
    city: string;
  }): string {
    return `Abordagem ${search.businessTypeQuery} - ${search.city}`;
  }

  private buildAssistedQueueObjective(
    objective: string | undefined,
    search: { businessTypeQuery: string; city: string },
  ): string {
    const details =
      objective?.trim() ||
      `preparar abordagem comercial para ${search.businessTypeQuery} em ${search.city}`;

    return `${ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX}: ${details}`;
  }

  private buildDirectDispatchObjective(
    objective: string | undefined,
    search: { businessTypeQuery: string; city: string },
  ): string {
    return (
      objective?.trim() ||
      `enviar primeira abordagem comercial para ${search.businessTypeQuery} em ${search.city}`
    );
  }
}
