import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import { IDispatchProspectExecutionUseCase } from './interfaces/IDispatchProspectExecutionUseCase';
import {
  DispatchNextProspectCampaignExecutionInput,
  DispatchNextProspectCampaignExecutionOutput,
  IDispatchNextProspectCampaignExecutionUseCase,
} from './interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { IStartProspectCampaignUseCase } from './interfaces/IStartProspectCampaignUseCase';
import {
  IProspectDispatchQueue,
  PROSPECT_DISPATCH_QUEUE,
} from '../../domain/ports/IProspectDispatchQueue';

@Injectable()
export class DispatchNextProspectCampaignExecutionUseCase implements IDispatchNextProspectCampaignExecutionUseCase {
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
    @Inject(IDispatchProspectExecutionUseCase)
    private readonly dispatchProspectExecutionUseCase: IDispatchProspectExecutionUseCase,
    @Inject(IStartProspectCampaignUseCase)
    private readonly startProspectCampaignUseCase: IStartProspectCampaignUseCase,
    @Inject(PROSPECT_DISPATCH_QUEUE)
    private readonly dispatchQueue: IProspectDispatchQueue,
  ) {}

  async execute(
    input: DispatchNextProspectCampaignExecutionInput,
  ): Promise<DispatchNextProspectCampaignExecutionOutput> {
    const campaign = await this.campaignRepository.findById(
      input.tenantId,
      input.campaignId,
    );

    if (!campaign) {
      throw new EntityNotFoundException('ProspectCampaign', input.campaignId);
    }

    if (campaign.status.value !== 'ACTIVE') {
      throw new ValidationErrorException(
        'Only active prospect campaigns can dispatch the next pending contact',
      );
    }

    let nextExecution =
      await this.executionRepository.findNextPendingByCampaign(
        input.tenantId,
        input.campaignId,
      );

    if (!nextExecution) {
      await this.startProspectCampaignUseCase.execute({
        tenantId: input.tenantId,
        campaignId: input.campaignId,
      });

      nextExecution = await this.executionRepository.findNextPendingByCampaign(
        input.tenantId,
        input.campaignId,
      );
    }

    if (!nextExecution) {
      throw new ValidationErrorException(
        'This prospect campaign has no pending contacts left to message',
      );
    }

    const dispatchResult = await this.dispatchProspectExecutionUseCase.execute({
      tenantId: input.tenantId,
      executionId: nextExecution.id.toString(),
    });

    const allExecutions = await this.executionRepository.findAllByCampaign(
      input.tenantId,
      input.campaignId,
    );

    const remainingPendingExecutions = allExecutions.filter(
      (execution) => execution.status.value === 'PENDING',
    ).length;

    if (remainingPendingExecutions > 0) {
      const contactedToday =
        await this.executionRepository.countContactedTodayByCampaign(
          input.tenantId,
          input.campaignId,
        );

      if (contactedToday < campaign.dailyLimit) {
        const delayMs =
          (Math.floor(
            Math.random() *
              (campaign.maxDelaySeconds - campaign.minDelaySeconds + 1),
          ) +
            campaign.minDelaySeconds) *
          1000;

        await this.dispatchQueue.scheduleNextDispatch(
          { tenantId: input.tenantId, campaignId: input.campaignId },
          delayMs,
        );
      }
    }

    return {
      campaignId: input.campaignId,
      executionId: dispatchResult.executionId,
      conversationId: dispatchResult.conversationId,
      messageId: dispatchResult.messageId,
      status: dispatchResult.status,
      renderedMessage: dispatchResult.renderedMessage,
      remainingPendingExecutions,
    };
  }
}
