import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface DashboardChatMessageRecord {
  id: string;
  tenantId: string;
  userId: string;
  threadId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: any;
  metadata?: any;
  createdAt: Date;
}

export interface SaveMessageInput {
  tenantId: string;
  userId: string;
  threadId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: any;
  metadata?: any;
}

@Injectable()
export class PrismaDashboardChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMessage(input: SaveMessageInput): Promise<DashboardChatMessageRecord> {
    return this.prisma.dashboardChatMessage.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        toolCalls: input.toolCalls || undefined,
        metadata: input.metadata || undefined,
      },
    }) as unknown as DashboardChatMessageRecord;
  }

  async getHistory(
    tenantId: string,
    threadId: string,
    limit = 20,
  ): Promise<DashboardChatMessageRecord[]> {
    const messages = await this.prisma.dashboardChatMessage.findMany({
      where: { tenantId, threadId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return (messages as unknown as DashboardChatMessageRecord[]).reverse();
  }

  async getThreadsByUser(
    tenantId: string,
    userId: string,
    limit = 10,
  ): Promise<string[]> {
    const results = await this.prisma.dashboardChatMessage.findMany({
      where: { tenantId, userId },
      select: { threadId: true, createdAt: true },
      distinct: ['threadId'],
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return results.map((r: any) => r.threadId);
  }

  async deleteOldThreads(
    tenantId: string,
    olderThan: Date,
  ): Promise<number> {
    const result = await this.prisma.dashboardChatMessage.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: olderThan },
      },
    });
    return result.count;
  }
}
