import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProspectCampaign } from '../../../domain/entities/ProspectCampaign';
import { IProspectCampaignRepository } from '../../../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaignMapper } from '../mappers/ProspectCampaignMapper';

@Injectable()
export class PrismaProspectCampaignRepository implements IProspectCampaignRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(campaign: ProspectCampaign): Promise<void> {
    const data = ProspectCampaignMapper.toPersistence(campaign);

    await this.prisma.prospectCampaign.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ProspectCampaign | null> {
    const raw = await this.prisma.prospectCampaign.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id,
        },
      },
    });

    return raw ? ProspectCampaignMapper.toDomain(raw) : null;
  }

  async findAllByTenant(tenantId: string): Promise<ProspectCampaign[]> {
    const results = await this.prisma.prospectCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return results.map(ProspectCampaignMapper.toDomain);
  }
}
