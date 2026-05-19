import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface MessagingMetricsResult {
  period: { start: Date; end: Date };
  totalActiveConversations: number;
  conversationsByChannel: Record<string, number>;
  conversationsByStatus: Record<string, number>;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  messagesBySentBy: Record<string, number>;
  unansweredOver1h: number;
  topTenantsByConversations: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

export interface ConversationListItem {
  id: string;
  tenantId: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  channel: string;
  status: string;
  assignedUserId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  lastMessageDirection: string | null;
  startedAt: Date;
  unreadCount: number;
}

@Injectable()
export class PlatformMessagingReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<MessagingMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      activeConversations,
      channelGroups,
      statusGroups,
      sentMessages,
      receivedMessages,
      sentByGroups,
      unanswered,
      topTenants,
    ] = await Promise.all([
      // Total active conversations
      this.prisma.conversation.count({
        where: { ...tenantFilter, status: 'ACTIVE' },
      }),
      // Conversations by channel
      this.prisma.conversation.groupBy({
        by: ['channel'],
        where: {
          ...tenantFilter,
          startedAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      // Conversations by status
      this.prisma.conversation.groupBy({
        by: ['status'],
        where: {
          ...tenantFilter,
          updatedAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      // Messages sent (OUTBOUND) in period
      this.prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: start, lte: end },
          ...(input.tenantId
            ? { conversation: { tenantId: input.tenantId } }
            : {}),
        },
      }),
      // Messages received (INBOUND) in period
      this.prisma.message.count({
        where: {
          direction: 'INBOUND',
          createdAt: { gte: start, lte: end },
          ...(input.tenantId
            ? { conversation: { tenantId: input.tenantId } }
            : {}),
        },
      }),
      // Messages by sentBy
      this.prisma.message.groupBy({
        by: ['sentBy'],
        where: {
          createdAt: { gte: start, lte: end },
          ...(input.tenantId
            ? { conversation: { tenantId: input.tenantId } }
            : {}),
        },
        _count: true,
      }),
      // Unanswered conversations > 1h
      this.prisma.conversation.count({
        where: {
          ...tenantFilter,
          status: 'ACTIVE',
          lastMessageDirection: 'INBOUND',
          lastMessageAt: {
            lte: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
      }),
      // Top tenants by conversation count
      this.prisma.conversation.groupBy({
        by: ['tenantId'],
        where: {
          startedAt: { gte: start, lte: end },
        },
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve tenant names for top tenants
    const topTenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: topTenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      period: { start, end },
      totalActiveConversations: activeConversations,
      conversationsByChannel: Object.fromEntries(
        channelGroups.map((g) => [g.channel, g._count]),
      ),
      conversationsByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      totalMessagesSent: sentMessages,
      totalMessagesReceived: receivedMessages,
      messagesBySentBy: Object.fromEntries(
        sentByGroups.map((g) => [g.sentBy, g._count]),
      ),
      unansweredOver1h: unanswered,
      topTenantsByConversations: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }

  async listConversations(input: {
    page: number;
    limit: number;
    tenantId?: string;
    channel?: string;
    status?: string;
    contactSearch?: string;
  }): Promise<{ items: ConversationListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.channel) where.channel = input.channel;
    if (input.status) where.status = input.status;
    if (input.contactSearch) {
      where.contact = {
        OR: [
          { name: { contains: input.contactSearch, mode: 'insensitive' } },
          { phone: { contains: input.contactSearch } },
        ],
      };
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          contact: { select: { name: true, phone: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Resolve tenant names
    const tenantIds = [...new Set(conversations.map((c) => c.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: ConversationListItem[] = conversations.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      companyName: tenantMap.get(c.tenantId) ?? 'Unknown',
      contactName: c.contact.name,
      contactPhone: c.contact.phone,
      channel: c.channel,
      status: c.status,
      assignedUserId: c.assignedUserId,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
      lastMessageDirection: c.lastMessageDirection,
      startedAt: c.startedAt,
      unreadCount: c.unreadCount,
    }));

    return { items, total };
  }
}
