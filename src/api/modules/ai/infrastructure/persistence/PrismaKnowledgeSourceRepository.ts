import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IKnowledgeSourceRepository,
  KnowledgeSourceRecord,
} from '@modules/ai/application/ports/IKnowledgeSourceRepository';

@Injectable()
export class PrismaKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaClient,
  ) {}

  async findById(
    tenantId: string,
    sourceId: string,
  ): Promise<KnowledgeSourceRecord | null> {
    const source = await this.prisma.knowledgeSource.findFirst({
      where: { id: sourceId, tenantId },
    });

    if (!source) {
      return null;
    }

    return {
      id: source.id,
      tenantId: source.tenantId,
      status: source.status,
      contentHash: source.contentHash ?? null,
    };
  }

  async updateStatus(
    tenantId: string,
    sourceId: string,
    status: string,
  ): Promise<void> {
    await this.prisma.knowledgeSource.updateMany({
      where: { id: sourceId, tenantId },
      data: { status },
    });
  }

  async markSynced(
    tenantId: string,
    sourceId: string,
    status: string,
    contentHash: string,
  ): Promise<void> {
    await this.prisma.knowledgeSource.updateMany({
      where: { id: sourceId, tenantId },
      data: { status, contentHash, lastSyncAt: new Date() },
    });
  }
}
