import { Injectable } from '@nestjs/common';
import { SearchCommerceCatalogUseCase } from '../../use-cases/SearchCommerceCatalogUseCase';

@Injectable()
export class CommerceConversationSearchService {
  constructor(
    private readonly searchCommerceCatalogUseCase: SearchCommerceCatalogUseCase,
  ) {}

  async searchCatalog(tenantId: string, userMessage: string) {
    if (userMessage.trim().length < 2 || /^\d{1,2}$/.test(userMessage.trim())) {
      return [];
    }

    return this.searchCommerceCatalogUseCase.execute({
      tenantId,
      query: userMessage,
      limit: 5,
    });
  }
}
