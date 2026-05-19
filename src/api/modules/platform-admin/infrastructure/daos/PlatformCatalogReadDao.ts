import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface CatalogMetricsResult {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  itemsByType: Record<string, number>;
  itemsWithImage: number;
  itemsWithoutPrice: number;
  totalCategories: number;
  topTenantsByCatalogSize: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformCatalogReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    tenantId?: string;
  }): Promise<CatalogMetricsResult> {
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalItems,
      activeItems,
      inactiveItems,
      typeGroups,
      itemsWithImage,
      itemsWithoutPrice,
      totalCategories,
      topTenants,
    ] = await Promise.all([
      this.prisma.catalogItem.count({ where: tenantFilter }),
      this.prisma.catalogItem.count({
        where: { ...tenantFilter, active: true },
      }),
      this.prisma.catalogItem.count({
        where: { ...tenantFilter, active: false },
      }),
      this.prisma.catalogItem.groupBy({
        by: ['type'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.catalogItem.count({
        where: { ...tenantFilter, imageUrl: { not: null } },
      }),
      this.prisma.catalogItem.count({
        where: { ...tenantFilter, basePrice: null },
      }),
      this.prisma.catalogCategory.count({ where: tenantFilter }),
      this.prisma.catalogItem.groupBy({
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
      activeItems,
      inactiveItems,
      itemsByType: Object.fromEntries(
        typeGroups.map((g) => [g.type, g._count]),
      ),
      itemsWithImage,
      itemsWithoutPrice,
      totalCategories,
      topTenantsByCatalogSize: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
