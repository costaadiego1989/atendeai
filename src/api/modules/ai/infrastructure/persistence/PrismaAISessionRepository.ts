import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  AISessionDto,
  AISessionMessageData,
  IAISessionRepository,
} from '../../application/ports/IAISessionRepository';

@Injectable()
export class PrismaAISessionRepository implements IAISessionRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaClient,
  ) {}

  async findActive(
    tenantId: string,
    contactId: string,
    conversationId: string,
  ): Promise<AISessionDto | null> {
    const session = await this.prisma.aISession.findFirst({
      where: {
        tenantId,
        contactId,
        conversationId,
        status: 'ACTIVE',
      },
    });

    return session ? this.toDto(session) : null;
  }

  async createActive(
    tenantId: string,
    contactId: string,
    conversationId: string,
  ): Promise<AISessionDto> {
    const session = await this.prisma.aISession.create({
      data: {
        tenantId,
        contactId,
        conversationId,
        status: 'ACTIVE',
        metadata: {},
      },
    });

    return this.toDto(session);
  }

  async recordMessage(data: AISessionMessageData): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.aIMessage.create({
        data: {
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          tokens: data.tokens,
          diagnostics: data.diagnostics,
        },
      }),
      this.prisma.aISession.update({
        where: { id: data.sessionId },
        data: {
          totalTokens: { increment: data.tokens },
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async close(
    sessionId: string,
    status: 'CLOSED' | 'EXPIRED' | 'HANDOFF',
  ): Promise<void> {
    await this.prisma.aISession.update({
      where: { id: sessionId },
      data: { status, updatedAt: new Date() },
    });
  }

  private toDto(session: {
    id: string;
    tenantId: string;
    contactId: string | null;
    status: string;
    totalTokens: number;
    metadata: any;
  }): AISessionDto {
    return {
      id: session.id,
      tenantId: session.tenantId,
      contactId: session.contactId!,
      status: session.status,
      totalTokens: session.totalTokens,
      metadata: session.metadata,
    };
  }
}
