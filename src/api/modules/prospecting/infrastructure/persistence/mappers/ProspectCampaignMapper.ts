import { ProspectCampaign as PrismaProspectCampaign } from '@prisma/client';
import { ProspectCampaign } from '../../../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ProspectAudienceTypeVO } from '../../../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../../../domain/value-objects/ProspectChannel';
import { ProspectCampaignStatusVO } from '../../../domain/value-objects/ProspectCampaignStatus';

export class ProspectCampaignMapper {
  public static toDomain(raw: PrismaProspectCampaign): ProspectCampaign {
    return ProspectCampaign.reconstitute(
      {
        tenantId: TenantId.create(raw.tenantId),
        name: raw.name,
        objective: raw.objective,
        audienceType: ProspectAudienceTypeVO.create(raw.audienceType),
        channel: ProspectChannelVO.create(raw.channel),
        targetContactIds: (raw.targetContactIds as string[] | null) ?? [],
        messageTemplate: raw.messageTemplate ?? undefined,
        dailyLimit: raw.dailyLimit,
        status: ProspectCampaignStatusVO.create(raw.status),
      },
      new UniqueEntityID(raw.id),
      raw.createdAt,
      raw.updatedAt,
    );
  }

  public static toPersistence(campaign: ProspectCampaign) {
    return {
      id: campaign.id.toString(),
      tenantId: campaign.tenantId.toString(),
      name: campaign.name,
      objective: campaign.objective,
      audienceType: campaign.audienceType.value,
      channel: campaign.channel.value,
      targetContactIds: campaign.targetContactIds,
      messageTemplate: campaign.messageTemplate ?? null,
      dailyLimit: campaign.dailyLimit,
      status: campaign.status.value,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
