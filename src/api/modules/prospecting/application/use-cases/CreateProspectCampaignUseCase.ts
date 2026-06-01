import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantFacade,
  TENANT_FACADE,
} from '@modules/tenant/application/facades/ITenantFacade';
import {
  ICreateProspectCampaignUseCase,
  CreateProspectCampaignInput,
  CreateProspectCampaignOutput,
} from './interfaces/ICreateProspectCampaignUseCase';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectAudienceTypeVO } from '../../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../../domain/value-objects/ProspectChannel';
import { ProspectDispatchPolicy } from '../services/ProspectDispatchPolicy';

@Injectable()
export class CreateProspectCampaignUseCase implements ICreateProspectCampaignUseCase {
  constructor(
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    private readonly dispatchPolicy: ProspectDispatchPolicy,
  ) {}

  async execute(
    input: CreateProspectCampaignInput,
  ): Promise<CreateProspectCampaignOutput> {
    const exists = await this.tenantFacade.tenantExists(input.tenantId);

    if (!exists) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    if (input.messageTemplate?.trim()) {
      this.dispatchPolicy.assertTemplateSupportsPersonalization(
        input.messageTemplate,
      );
    }

    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create(input.tenantId),
      name: input.name,
      objective: input.objective,
      audienceType: ProspectAudienceTypeVO.create(input.audienceType),
      channel: ProspectChannelVO.create(input.channel),
      targetContactIds: input.targetContactIds,
      messageTemplate: input.messageTemplate,
      dailyLimit: input.dailyLimit,
    });

    await this.campaignRepository.save(campaign);

    return {
      id: campaign.id.toString(),
      tenantId: campaign.tenantId.toString(),
      name: campaign.name,
      objective: campaign.objective,
      audienceType: campaign.audienceType.value,
      channel: campaign.channel.value,
      targetContactIds: campaign.targetContactIds,
      messageTemplate: campaign.messageTemplate,
      dailyLimit: campaign.dailyLimit,
      status: campaign.status.value,
      createdAt: campaign.createdAt,
    };
  }
}
