import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  ActivateProspectCampaignInput,
  ActivateProspectCampaignOutput,
  IActivateProspectCampaignUseCase,
} from './interfaces/IActivateProspectCampaignUseCase';

@Injectable()
export class ActivateProspectCampaignUseCase implements IActivateProspectCampaignUseCase {
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
  ) {}

  async execute(
    input: ActivateProspectCampaignInput,
  ): Promise<ActivateProspectCampaignOutput> {
    const campaign = await this.campaignRepository.findById(
      input.tenantId,
      input.campaignId,
    );

    if (!campaign) {
      throw new EntityNotFoundException('ProspectCampaign', input.campaignId);
    }

    campaign.activate();
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
