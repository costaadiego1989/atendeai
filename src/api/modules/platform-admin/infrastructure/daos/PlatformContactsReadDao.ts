import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface ContactsMetricsResult {
  period: { start: Date; end: Date };
  totalContacts: number;
  newInPeriod: number;
  byStage: Record<string, number>;
  prospectingOptOut: number;
  inactiveOver30d: number;
  topTenantsByContacts: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

export interface ContactListItem {
  id: string;
  tenantId: string;
  companyName: string;
  name: string;
  phone: string;
  email: string | null;
  stage: string;
  prospectingOptOut: boolean;
  lastInteraction: Date | null;
  createdAt: Date;
}

@Injectable()
export class PlatformContactsReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<ContactsMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalContacts,
      newInPeriod,
      stageGroups,
      optOutCount,
      inactiveCount,
      topTenants,
    ] = await Promise.all([
      this.prisma.contact.count({ where: tenantFilter }),
      this.prisma.contact.count({
        where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.contact.groupBy({
        by: ['stage'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.contact.count({
        where: { ...tenantFilter, prospectingOptOut: true },
      }),
      this.prisma.contact.count({
        where: {
          ...tenantFilter,
          OR: [
            { lastInteraction: null },
            {
              lastInteraction: {
                lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      }),
      this.prisma.contact.groupBy({
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
      period: { start, end },
      totalContacts,
      newInPeriod,
      byStage: Object.fromEntries(stageGroups.map((g) => [g.stage, g._count])),
      prospectingOptOut: optOutCount,
      inactiveOver30d: inactiveCount,
      topTenantsByContacts: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }

  async listContacts(input: {
    page: number;
    limit: number;
    tenantId?: string;
    stage?: string;
    search?: string;
  }): Promise<{ items: ContactListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.stage) where.stage = input.stage;
    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { phone: { contains: input.search } },
        { email: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where }),
    ]);

    const tenantIds = [...new Set(contacts.map((c) => c.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: ContactListItem[] = contacts.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      companyName: tenantMap.get(c.tenantId) ?? 'Unknown',
      name: c.name,
      phone: c.phone,
      email: c.email,
      stage: c.stage,
      prospectingOptOut: c.prospectingOptOut,
      lastInteraction: c.lastInteraction,
      createdAt: c.createdAt,
    }));

    return { items, total };
  }
}
