import { Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
  InventoryItemRecord,
} from '../../domain/ports/IInventoryRepository';
import { Inject } from '@nestjs/common';

export type GenerateInventoryReportInput = {
  tenantId: string;
  query?: string;
  availableOnly?: boolean;
  statuses?: Array<'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'>;
};

export type GenerateInventoryReportOutput = {
  generatedAt: Date;
  summary: {
    totalItems: number;
    totalQuantity: number;
    availableItems: number;
    lowStockItems: number;
    unavailableItems: number;
    reservedItems: number;
    estimatedInventoryValue: number;
  };
  items: InventoryItemRecord[];
};

@Injectable()
export class GenerateInventoryReportUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(
    input: GenerateInventoryReportInput,
  ): Promise<GenerateInventoryReportOutput> {
    const items = await this.inventoryRepository.listItems({
      tenantId: input.tenantId,
      query: input.query,
      availableOnly: input.availableOnly,
    });

    const statuses = new Set<
      'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'
    >(
      (input.statuses ?? []).filter(Boolean) as Array<
        'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'
      >,
    );
    const filteredItems =
      statuses.size === 0
        ? items
        : items.filter((item) =>
            statuses.has(
              item.availabilityStatus as
                | 'AVAILABLE'
                | 'LOW_STOCK'
                | 'UNAVAILABLE'
                | 'RESERVED',
            ),
          );

    return {
      generatedAt: new Date(),
      summary: {
        totalItems: filteredItems.length,
        totalQuantity: filteredItems.reduce(
          (total, item) => total + item.availableQuantity,
          0,
        ),
        availableItems: filteredItems.filter(
          (item) => item.availabilityStatus === 'AVAILABLE',
        ).length,
        lowStockItems: filteredItems.filter(
          (item) => item.availabilityStatus === 'LOW_STOCK',
        ).length,
        unavailableItems: filteredItems.filter(
          (item) => item.availabilityStatus === 'UNAVAILABLE',
        ).length,
        reservedItems: filteredItems.filter(
          (item) => item.availabilityStatus === 'RESERVED',
        ).length,
        estimatedInventoryValue: filteredItems.reduce((total, item) => {
          const currentPrice =
            item.currentPrice == null ? 0 : Number(item.currentPrice);
          return total + currentPrice * item.availableQuantity;
        }, 0),
      },
      items: filteredItems,
    };
  }
}
