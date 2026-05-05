import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';

export interface CreateCatalogCategoryCommand {
  tenantId: string;
  parentCategoryId?: string;
  name: string;
  description?: string;
}

@Injectable()
export class CreateCatalogCategoryUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  async execute(command: CreateCatalogCategoryCommand) {
    const category = await this.catalogRepository.createCategory({
      tenantId: command.tenantId,
      parentCategoryId: command.parentCategoryId,
      name: command.name.trim(),
      description: command.description?.trim() || undefined,
    });

    await this.catalogRepository.saveAuditLog({
      tenantId: category.tenantId,
      event: 'CATEGORY_CREATED',
      entityId: category.id,
      entityType: 'CATEGORY',
      metadata: {
        name: category.name,
        parentCategoryId: category.parentCategoryId,
      },
    });

    return category;
  }
}
