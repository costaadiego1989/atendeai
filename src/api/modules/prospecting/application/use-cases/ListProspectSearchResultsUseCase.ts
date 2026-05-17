import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectSearchResultRepository';
import {
  IListProspectSearchResultsUseCase,
  ListProspectSearchResultsInput,
  ProspectSearchResultListItem,
} from './interfaces/IListProspectSearchResultsUseCase';

@Injectable()
export class ListProspectSearchResultsUseCase implements IListProspectSearchResultsUseCase {
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_RESULT_REPOSITORY)
    private readonly searchResultRepository: IProspectSearchResultRepository,
  ) {}

  async execute(
    input: ListProspectSearchResultsInput,
  ): Promise<ProspectSearchResultListItem[]> {
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

    return results.map((result) => ({
      id: result.id.toString(),
      searchId: result.searchId.toString(),
      source: result.source.value,
      externalId: result.externalId,
      businessName: result.businessName,
      city: result.city,
      state: result.state,
      phone: result.phone,
      whatsappPhone: result.whatsappPhone,
      instagramUrl: result.instagramUrl,
      email: result.email,
      website: result.website,
      createdAt: result.createdAt,
    }));
  }
}
