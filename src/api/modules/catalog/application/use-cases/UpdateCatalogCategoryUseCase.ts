import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';

export interface UpdateCatalogCategoryCommand {
  tenantId: string;
  categoryId: string;
  parentCategoryId?: string | null;
  name: string;
  description?: string;
}

@Injectable()
export class UpdateCatalogCategoryUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async execute(command: UpdateCatalogCategoryCommand) {
    const category = await this.catalogRepository.findCategoryById(
      command.tenantId,
      command.categoryId,
    );

    if (!category) {
      throw new EntityNotFoundException('CatalogCategory', command.categoryId);
    }

    const updatedCategory = await this.catalogRepository.updateCategory({
      tenantId: command.tenantId,
      categoryId: command.categoryId,
      parentCategoryId: command.parentCategoryId,
      name: command.name.trim(),
      description: command.description?.trim() || undefined,
    });

    await this.catalogRepository.saveAuditLog({
      tenantId: updatedCategory.tenantId,
      event: 'CATEGORY_UPDATED',
      entityId: updatedCategory.id,
      entityType: 'CATEGORY',
      metadata: {
        name: updatedCategory.name,
        parentCategoryId: updatedCategory.parentCategoryId,
      },
    });

    return updatedCategory;
  }
}
