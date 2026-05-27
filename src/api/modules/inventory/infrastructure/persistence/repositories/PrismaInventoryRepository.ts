import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CreateInventoryConnectionInput,
  IInventoryRepository,
  InventoryConnectionRecord,
  InventoryItemRecord,
  ListInventoryItemsFilters,
  SyncInventoryItemInput,
} from '../../../domain/ports/IInventoryRepository';
import {
  ICredentialCipher,
  INVENTORY_CREDENTIAL_CIPHER,
} from '../../../application/ports/ICredentialCipher';
import { getProviderSecretKeys } from '../../../application/providers/provider-secret-keys';
import { InventoryCredentialDecryptionError } from '../../../domain/errors/InventoryCredentialDecryptionError';

const ENCRYPTED_PREFIX = 'v1:';

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  private readonly logger = new Logger(PrismaInventoryRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVENTORY_CREDENTIAL_CIPHER)
    private readonly credentialCipher: ICredentialCipher,
  ) {}

  async syncItem(input: SyncInventoryItemInput): Promise<InventoryItemRecord> {
    const item = await this.prisma.inventoryItem.upsert({
      where: {
        tenantId_sku: {
          tenantId: input.tenantId,
          sku: input.sku,
        },
      },
      create: {
        tenantId: input.tenantId,
        catalogItemId: input.catalogItemId,
        sku: input.sku,
        externalReference: input.externalReference,
        name: input.name,
        availableQuantity: input.availableQuantity,
        availabilityStatus: input.availabilityStatus,
        currentPrice: input.currentPrice,
        currency: input.currency || 'BRL',
        source: input.source || 'MANUAL_SNAPSHOT',
        lastSyncedAt: new Date(),
      },
      update: {
        catalogItemId: input.catalogItemId,
        externalReference: input.externalReference,
        name: input.name,
        availableQuantity: input.availableQuantity,
        availabilityStatus: input.availabilityStatus,
        currentPrice: input.currentPrice,
        currency: input.currency || 'BRL',
        source: input.source || 'MANUAL_SNAPSHOT',
        lastSyncedAt: new Date(),
      },
    });

    return this.mapItem(item);
  }

  async listItems(
    filters: ListInventoryItemsFilters,
  ): Promise<InventoryItemRecord[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: filters.tenantId,
        OR: filters.query
          ? [
              {
                name: {
                  contains: filters.query,
                  mode: 'insensitive',
                },
              },
              {
                sku: {
                  contains: filters.query,
                  mode: 'insensitive',
                },
              },
              {
                externalReference: {
                  contains: filters.query,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
        availableQuantity: filters.availableOnly ? { gt: 0 } : undefined,
        availabilityStatus: filters.availableOnly
          ? {
              in: ['AVAILABLE', 'LOW_STOCK'],
            }
          : undefined,
      },
      orderBy: [
        {
          availabilityStatus: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });

    return items.map((item) => this.mapItem(item));
  }

  async findItemBySku(
    tenantId: string,
    sku: string,
  ): Promise<InventoryItemRecord | null> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: {
        tenantId_sku: { tenantId, sku },
      },
    });

    return item ? this.mapItem(item) : null;
  }

  async createConnection(
    input: CreateInventoryConnectionInput,
  ): Promise<InventoryConnectionRecord> {
    const encryptedConfig = this.encryptSecrets(
      input.sourceType,
      input.config || {},
    );

    const connection = await this.prisma.inventoryConnection.create({
      data: {
        tenantId: input.tenantId,
        sourceType: input.sourceType,
        providerName: input.providerName,
        status: input.status ?? 'ACTIVE',
        config: encryptedConfig as Prisma.InputJsonValue,
      },
    });

    return this.mapConnection(connection);
  }

  private encryptSecrets(
    sourceType: string,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const secretKeys = getProviderSecretKeys(sourceType);
    if (secretKeys.length === 0) {
      return config;
    }

    const result: Record<string, unknown> = { ...config };
    for (const key of secretKeys) {
      const value = result[key];
      if (typeof value === 'string' && !value.startsWith(ENCRYPTED_PREFIX)) {
        result[key] = this.credentialCipher.encrypt(value);
      }
    }

    return result;
  }

  async getConnection(
    tenantId: string,
    id: string,
  ): Promise<InventoryConnectionRecord | null> {
    const connection = await this.prisma.inventoryConnection.findFirst({
      where: { id, tenantId },
    });

    return connection ? this.mapConnection(connection) : null;
  }

  async listConnections(
    tenantId: string,
  ): Promise<InventoryConnectionRecord[]> {
    const connections = await this.prisma.inventoryConnection.findMany({
      where: {
        tenantId,
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
      ],
    });

    return connections.map((connection) => this.mapConnection(connection));
  }

  async findConnectionByProvider(
    tenantId: string,
    sourceType: string,
    providerName: string,
  ): Promise<InventoryConnectionRecord | null> {
    const connection = await this.prisma.inventoryConnection.findFirst({
      where: {
        tenantId,
        sourceType,
        providerName: {
          equals: providerName,
          mode: 'insensitive',
        },
      },
    });

    return connection ? this.mapConnection(connection) : null;
  }

  async markConnectionSyncedAt(
    tenantId: string,
    connectionId: string,
    syncedAt: Date,
  ): Promise<void> {
    await this.prisma.inventoryConnection.updateMany({
      where: { id: connectionId, tenantId },
      data: { lastSyncedAt: syncedAt },
    });
  }

  private mapItem(item: {
    id: string;
    tenantId: string;
    catalogItemId: string | null;
    sku: string;
    externalReference: string | null;
    name: string;
    availableQuantity: number;
    availabilityStatus: string;
    currentPrice: { toString(): string } | null;
    currency: string;
    source: string;
    lastSyncedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryItemRecord {
    const currentPrice =
      item.currentPrice == null
        ? null
        : Number(item.currentPrice.toString()).toFixed(2);

    return {
      id: item.id,
      tenantId: item.tenantId,
      catalogItemId: item.catalogItemId,
      sku: item.sku,
      externalReference: item.externalReference,
      name: item.name,
      availableQuantity: item.availableQuantity,
      availabilityStatus: item.availabilityStatus,
      currentPrice,
      currency: item.currency,
      source: item.source,
      lastSyncedAt: item.lastSyncedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private mapConnection(connection: {
    id: string;
    tenantId: string;
    sourceType: string;
    providerName: string;
    status: string;
    config: unknown;
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryConnectionRecord {
    const storedConfig =
      connection.config && typeof connection.config === 'object'
        ? (connection.config as Record<string, unknown>)
        : {};

    const secretKeys = getProviderSecretKeys(connection.sourceType);
    const configObj = this.decryptSecrets(
      connection.id,
      connection.sourceType,
      storedConfig,
      secretKeys,
    );

    return {
      id: connection.id,
      tenantId: connection.tenantId,
      sourceType: connection.sourceType,
      providerName: connection.providerName,
      status: connection.status,
      config: configObj,
      configSummary: this.buildConfigSummary(configObj, secretKeys),
      lastSyncedAt: connection.lastSyncedAt,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  private decryptSecrets(
    connectionId: string,
    sourceType: string,
    config: Record<string, unknown>,
    secretKeys: string[],
  ): Record<string, unknown> {
    if (secretKeys.length === 0) {
      return config;
    }

    const result: Record<string, unknown> = { ...config };
    for (const key of secretKeys) {
      const value = result[key];
      if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
        try {
          result[key] = this.credentialCipher.decrypt(value);
        } catch {
          this.logger.error(
            `Failed to decrypt inventory credential (connectionId=${connectionId}, sourceType=${sourceType})`,
          );
          throw new InventoryCredentialDecryptionError(connectionId);
        }
      }
    }

    return result;
  }

  private buildConfigSummary(
    config: Record<string, unknown>,
    secretKeys: string[],
  ): string | undefined {
    const secretKeySet = new Set(secretKeys);
    const nonSecretEntries = Object.entries(config).filter(
      ([key]) => !secretKeySet.has(key),
    );

    const summaryEntry = nonSecretEntries.find(
      ([key, value]) => key === 'summary' && typeof value === 'string',
    );

    return summaryEntry ? (summaryEntry[1] as string) : undefined;
  }
}
