import {
  Prisma,
  ProspectCampaign as PrismaProspectCampaign,
} from '@prisma/client';
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
        templateName: raw.templateName ?? undefined,
        languageCode: raw.languageCode,
        templateVariableMapping:
          (raw.templateVariableMapping as Record<string, string> | null) ??
          undefined,
        aiVariableGeneration: raw.aiVariableGeneration,
        cooldownDays: raw.cooldownDays,
        minDelaySeconds: raw.minDelaySeconds,
        maxDelaySeconds: raw.maxDelaySeconds,
        blockRateThreshold: raw.blockRateThreshold,
        dailyLimit: raw.dailyLimit,
        status: ProspectCampaignStatusVO.create(raw.status),
        pauseReason: (raw as any).pauseReason ?? undefined,
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
      templateName: campaign.templateName ?? null,
      languageCode: campaign.languageCode,
      templateVariableMapping:
        campaign.templateVariableMapping ?? Prisma.JsonNull,
      aiVariableGeneration: campaign.aiVariableGeneration,
      cooldownDays: campaign.cooldownDays,
      minDelaySeconds: campaign.minDelaySeconds,
      maxDelaySeconds: campaign.maxDelaySeconds,
      blockRateThreshold: campaign.blockRateThreshold,
      dailyLimit: campaign.dailyLimit,
      status: campaign.status.value,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
