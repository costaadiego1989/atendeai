import { Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  IInventoryRepository,
} from '../../domain/ports/IInventoryRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { InventoryDuplicateConnectionError } from '../../domain/errors/InventoryDuplicateConnectionError';
import { InventoryConnectionCreatedIntegrationEvent } from '../integration-events/InventoryIntegrationEvents';
import {
  IInventoryProviderFactory,
  INVENTORY_PROVIDER_FACTORY,
} from '../ports/IInventoryProvider';

export interface CreateInventoryConnectionCommand {
  tenantId: string;
  sourceType: string;
  providerName: string;
  config?: Record<string, unknown>;
}

@Injectable()
export class CreateInventoryConnectionUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(INVENTORY_PROVIDER_FACTORY)
    private readonly providerFactory: IInventoryProviderFactory,
  ) {}

  async execute(command: CreateInventoryConnectionCommand) {
    const providerName = command.providerName.trim();
    const existing = await this.inventoryRepository.findConnectionByProvider(
      command.tenantId,
      command.sourceType,
      providerName,
    );

    if (existing) {
      throw new InventoryDuplicateConnectionError(
        providerName,
        command.sourceType,
      );
    }

    await this.tryValidateConnection(command.sourceType, command.config || {});

    const connection = await this.inventoryRepository.createConnection({
      tenantId: command.tenantId,
      sourceType: command.sourceType,
      providerName,
      config: command.config || {},
    });

    await this.eventBus.publish(
      new InventoryConnectionCreatedIntegrationEvent({
        connectionId: connection.id,
        tenantId: connection.tenantId,
        sourceType: connection.sourceType,
        providerName: connection.providerName,
      }),
    );

    return connection;
  }

  private async tryValidateConnection(
    sourceType: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    if (!this.shouldAttemptValidation(sourceType, config)) {
      return;
    }

    try {
      const provider = this.providerFactory.getProvider(sourceType);
      await provider.testConnection(config);
    } catch {
      // Ignore
    }
  }

  private shouldAttemptValidation(
    sourceType: string,
    config: Record<string, unknown>,
  ): boolean {
    if (sourceType === 'MANUAL_SNAPSHOT' || sourceType === 'CSV_IMPORT') {
      return false;
    }

    return Object.keys(config).length > 0;
  }
}
