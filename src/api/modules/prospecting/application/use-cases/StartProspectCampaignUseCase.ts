import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ProspectDispatchPolicy } from '../services/ProspectDispatchPolicy';
import { ProspectExecution } from '../../domain/entities/ProspectExecution';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  IStartProspectCampaignUseCase,
  StartProspectCampaignInput,
  StartProspectCampaignOutput,
} from './interfaces/IStartProspectCampaignUseCase';

@Injectable()
export class StartProspectCampaignUseCase
  implements IStartProspectCampaignUseCase
{
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    private readonly dispatchPolicy: ProspectDispatchPolicy,
  ) {}

  async execute(
    input: StartProspectCampaignInput,
  ): Promise<StartProspectCampaignOutput> {
    const campaign = await this.campaignRepository.findById(
      input.tenantId,
      input.campaignId,
    );

    if (!campaign) {
      throw new EntityNotFoundException('ProspectCampaign', input.campaignId);
    }

    this.dispatchPolicy.assertCanStartCampaign(campaign);

    const audienceContactIds = await this.resolveAudienceContactIds(
      input.tenantId,
      campaign.audienceType.value,
      campaign.targetContactIds,
      campaign.dailyLimit,
    );

    if (audienceContactIds.length === 0) {
      throw new ValidationErrorException(
        'Prospect campaign audience is empty',
      );
    }

    const existingExecutions = await this.executionRepository.findAllByCampaign(
      input.tenantId,
      input.campaignId,
    );
    const existingContactIds = new Set(
      existingExecutions.map((execution) => execution.contactId),
    );

    const freshContactIds = audienceContactIds.filter(
      (contactId) => !existingContactIds.has(contactId),
    );

    const executions = freshContactIds.map((contactId) =>
      ProspectExecution.create({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        contactId,
        channel: campaign.channel,
      }),
    );

    if (executions.length > 0) {
      await this.executionRepository.saveMany(executions);
    }

    return {
      campaignId: campaign.id.toString(),
      createdExecutions: executions.length,
      skippedExecutions: audienceContactIds.length - executions.length,
      executions: executions.map((execution) => ({
        id: execution.id.toString(),
        contactId: execution.contactId,
        status: execution.status.value,
      })),
    };
  }

  private async resolveAudienceContactIds(
    tenantId: string,
    audienceType: 'REENGAGEMENT' | 'CONTACT_LIST',
    targetContactIds: string[],
    dailyLimit: number,
  ): Promise<string[]> {
    if (audienceType === 'CONTACT_LIST') {
      return [...new Set(targetContactIds)].slice(0, dailyLimit);
    }

    return this.contactFacade.findContactIdsForReengagementAudience(
      tenantId,
      dailyLimit,
    );
  }
}
