import { Inject, Injectable } from '@nestjs/common';
import {
  IListProspectSearchesUseCase,
  ListProspectSearchesInput,
  ProspectSearchListItem,
} from './interfaces/IListProspectSearchesUseCase';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';

@Injectable()
export class ListProspectSearchesUseCase implements IListProspectSearchesUseCase {
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
  ) {}

  async execute(
    input: ListProspectSearchesInput,
  ): Promise<ProspectSearchListItem[]> {
    const searches = await this.searchRepository.findAllByTenant(
      input.tenantId,
    );

    return searches.map((search) => ({
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
      updatedAt: search.updatedAt,
    }));
  }
}
