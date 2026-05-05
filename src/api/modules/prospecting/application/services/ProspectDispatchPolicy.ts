import { Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../../domain/entities/ProspectExecution';

export const ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX =
  'Abordagem assistida de prospecção local';

@Injectable()
export class ProspectDispatchPolicy {
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
}
