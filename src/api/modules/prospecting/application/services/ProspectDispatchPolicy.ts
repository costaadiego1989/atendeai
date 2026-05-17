import { Inject, Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../../domain/entities/ProspectExecution';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  ProspectCooldownActiveError,
  ProspectNoWhatsAppPhoneError,
  ProspectOptOutError,
} from '../../domain/errors/ProspectingErrors';

export const ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX =
  'Abordagem assistida de prospecção local';

@Injectable()
export class ProspectDispatchPolicy {
  constructor(
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
  ) {}

  assertCanStartCampaign(campaign: ProspectCampaign): void {
    if (campaign.status.value !== 'ACTIVE') {
      throw new ValidationErrorException(
        'Only active prospect campaigns can be started',
      );
    }

    this.assertCampaignIsNotAssistedLocalQueue(campaign);
    this.assertTemplateSupportsPersonalization(campaign.messageTemplate);
  }

  assertCanDispatch(
    campaign: ProspectCampaign,
    execution: ProspectExecution,
  ): void {
    this.assertCampaignIsNotAssistedLocalQueue(campaign);
    this.assertExecutionCanDispatch(execution);

    if (campaign.templateName) return;

    if (!campaign.messageTemplate?.trim()) {
      throw new ValidationErrorException(
        'Prospect campaign requires a message template before dispatch',
      );
    }

    this.assertTemplateSupportsPersonalization(campaign.messageTemplate);
  }

  assertExecutionCanDispatch(execution: ProspectExecution): void {
    if (execution.status.value !== 'PENDING') {
      throw new ValidationErrorException(
        'Only pending prospect executions can be dispatched',
      );
    }
  }

  private assertCampaignIsNotAssistedLocalQueue(
    campaign: ProspectCampaign,
  ): void {
    if (
      campaign.objective
        .trim()
        .startsWith(ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX)
    ) {
      throw new ValidationErrorException(
        'Assisted local prospecting queues cannot dispatch messages automatically',
      );
    }
  }

  assertTemplateSupportsPersonalization(template?: string | null): void {
    const value = template?.trim() ?? '';

    if (!value) {
      throw new ValidationErrorException(
        'Prospect campaign requires a message template before dispatch',
      );
    }

    const hasNameToken =
      value.includes('{{name}}') || value.includes('{{first_name}}');
    if (!hasNameToken) {
      throw new ValidationErrorException(
        'Prospect campaign message template must include {{name}} or {{first_name}}',
      );
    }
  }

  async assertContactEligible(
    campaign: ProspectCampaign,
    execution: ProspectExecution,
    contact: { phone: string; prospectingOptOut: boolean },
  ): Promise<void> {
    if (contact.prospectingOptOut) {
      throw new ProspectOptOutError(execution.contactId);
    }

    if (campaign.channel.value === 'WHATSAPP' && !contact.phone?.trim()) {
      throw new ProspectNoWhatsAppPhoneError(execution.contactId);
    }

    const lastContactedAt = await this.executionRepository.findLastContactedAt(
      execution.tenantId.toString(),
      execution.contactId,
    );

    if (lastContactedAt) {
      const cooldownMs = campaign.cooldownDays * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - cooldownMs);
      if (lastContactedAt > cutoff) {
        throw new ProspectCooldownActiveError(
          execution.contactId,
          campaign.cooldownDays,
        );
      }
    }
  }
}
