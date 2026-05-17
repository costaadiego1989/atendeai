import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CatalogCategoryNotFoundError } from '../../domain/errors/CatalogCategoryNotFoundError';
import { CatalogCategoryInUseError } from '../../domain/errors/CatalogCategoryInUseError';
import { CatalogCategoryDeactivatedIntegrationEvent } from '../integration-events/CatalogIntegrationEvents';

export interface DeactivateCatalogCategoryCommand {
  tenantId: string;
  categoryId: string;
}

@Injectable()
export class DeactivateCatalogCategoryUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(command: DeactivateCatalogCategoryCommand) {
    const category = await this.catalogRepository.findCategoryById(
      command.tenantId,
      command.categoryId,
    );

    if (!category) {
      throw new CatalogCategoryNotFoundError(command.categoryId);
    }

    const hasActiveItems =
      await this.catalogRepository.hasActiveItemsInCategory(
        command.tenantId,
        command.categoryId,
      );

    if (hasActiveItems) {
      throw new CatalogCategoryInUseError(command.categoryId);
    }

    const result = await this.catalogRepository.deactivateCategory(
      command.tenantId,
      command.categoryId,
    );

    await this.eventBus.publish(
      new CatalogCategoryDeactivatedIntegrationEvent({
        categoryId: command.categoryId,
        tenantId: command.tenantId,
      }),
    );

    await this.catalogRepository.saveAuditLog({
      tenantId: command.tenantId,
      event: 'CATEGORY_DEACTIVATED',
      entityId: command.categoryId,
      entityType: 'CATEGORY',
    });

    return result;
  }
}
