import { Injectable } from '@nestjs/common';
import { SearchCommerceCatalogUseCase } from '@modules/commerce/application/use-cases/SearchCommerceCatalogUseCase';
import {
  CommerceCatalogSearchInput,
  CommerceCatalogSearchOption,
  ICommerceCatalogSearch,
} from '../../application/ports/ICommerceCatalogSearch';

@Injectable()
export class CommerceCatalogSearchAdapter implements ICommerceCatalogSearch {
  constructor(
    private readonly searchCommerceCatalogUseCase: SearchCommerceCatalogUseCase,
  ) {}

  async search(
    input: CommerceCatalogSearchInput,
  ): Promise<CommerceCatalogSearchOption[]> {
    const results = await this.searchCommerceCatalogUseCase.execute({
      tenantId: input.tenantId,
      query: input.query,
      limit: input.limit,
    });

    return results.map((option) => ({
      optionNumber: option.optionNumber,
      name: option.name,
      price: option.price,
      currency: option.currency,
      availableQuantity: option.availableQuantity,
      categoryName: option.categoryName,
      attributes: option.attributes,
      variants: option.variants,
      optionGroups: option.optionGroups,
    }));
  }
}
