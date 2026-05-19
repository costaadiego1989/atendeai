import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface InventoryMetricsResult {
  totalItems: number;
  itemsOutOfStock: number;
  itemsUnavailable: number;
  activeConnections: number;
  connectionsSyncOver24h: number;
  topTenantsBySkus: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformInventoryReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    tenantId?: string;
  }): Promise<InventoryMetricsResult> {
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalItems,
      itemsOutOfStock,
      itemsUnavailable,
      activeConnections,
      connectionsSyncOver24h,
      topTenants,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: tenantFilter }),
      this.prisma.inventoryItem.count({
        where: { ...tenantFilter, availableQuantity: 0 },
      }),
      this.prisma.inventoryItem.count({
        where: { ...tenantFilter, availabilityStatus: 'UNAVAILABLE' },
      }),
      this.prisma.inventoryConnection.count({
        where: { ...tenantFilter, status: 'ACTIVE' },
      }),
      this.prisma.inventoryConnection.count({
        where: {
          ...tenantFilter,
          status: 'ACTIVE',
          lastSyncedAt: {
            lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['tenantId'],
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      totalItems,
      itemsOutOfStock,
      itemsUnavailable,
      activeConnections,
      connectionsSyncOver24h,
      topTenantsBySkus: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
