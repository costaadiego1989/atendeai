import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
  WhatsAppTemplateComponent,
} from '@modules/messaging/application/facades/MessagingFacade';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectDispatchPolicy } from '../services/ProspectDispatchPolicy';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  DispatchProspectExecutionInput,
  DispatchProspectExecutionOutput,
  IDispatchProspectExecutionUseCase,
} from './interfaces/IDispatchProspectExecutionUseCase';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { ProspectTemplateUnavailableError } from '../../domain/errors/ProspectingErrors';
import { ProspectStopReasonVO } from '../../domain/value-objects/ProspectStopReason';

@Injectable()
export class DispatchProspectExecutionUseCase implements IDispatchProspectExecutionUseCase {
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    private readonly dispatchPolicy: ProspectDispatchPolicy,
  ) {}

  async execute(
    input: DispatchProspectExecutionInput,
  ): Promise<DispatchProspectExecutionOutput> {
    const execution = await this.executionRepository.findById(
      input.tenantId,
      input.executionId,
    );

    if (!execution) {
      throw new EntityNotFoundException('ProspectExecution', input.executionId);
    }

    this.dispatchPolicy.assertExecutionCanDispatch(execution);

    const campaign = await this.campaignRepository.findById(
      input.tenantId,
      execution.campaignId.toString(),
    );

    if (!campaign) {
      throw new EntityNotFoundException(
        'ProspectCampaign',
        execution.campaignId.toString(),
      );
    }

    this.dispatchPolicy.assertCanDispatch(campaign, execution);

    const contact = await this.contactFacade.getContactById(
      input.tenantId,
      execution.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', execution.contactId);
    }

    await this.dispatchPolicy.assertContactEligible(
      campaign,
      execution,
      contact,
    );

    let dispatchResult: { conversationId: string; messageId: string };
    let renderedMessage: string;

    if (campaign.templateName) {
      const components = this.buildTemplateComponents(campaign, contact);
      renderedMessage = this.renderTemplate(
        campaign.messageTemplate?.trim() ?? '',
        contact.name,
      );

      try {
        dispatchResult = await this.messagingFacade.queueTemplateMessage({
          tenantId: input.tenantId,
          contactId: execution.contactId,
          phone: contact.phone,
          channel: 'WHATSAPP',
          templateName: campaign.templateName,
          languageCode: campaign.languageCode,
          components,
          renderedBody: renderedMessage,
        });
      } catch (error) {
        if (error instanceof ProspectTemplateUnavailableError) {
          execution.markAsFailedDispatch(
            ProspectStopReasonVO.create('TEMPLATE_UNAVAILABLE'),
          );
          await this.executionRepository.save(execution);
          campaign.pause();
          await this.campaignRepository.save(campaign);
        }
        throw error;
      }
    } else {
      const messageTemplate = campaign.messageTemplate?.trim() ?? '';
      renderedMessage = this.renderTemplate(messageTemplate, contact.name);
      dispatchResult = await this.messagingFacade.queueSystemMessage({
        tenantId: input.tenantId,
        contactId: execution.contactId,
        channel: execution.channel.value as 'WHATSAPP' | 'INSTAGRAM',
        text: renderedMessage,
      });
    }

    execution.markAsContacted();
    await this.executionRepository.save(execution);

    return {
      executionId: execution.id.toString(),
      conversationId: dispatchResult.conversationId,
      messageId: dispatchResult.messageId,
      status: execution.status.value,
      renderedMessage,
    };
  }

  private renderTemplate(template: string, fullName: string): string {
    const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;

    return template
      .replaceAll('{{name}}', fullName)
      .replaceAll('{{first_name}}', firstName);
  }

  private resolveContactField(
    contact: { name: string; phone: string; email?: string },
    field: string,
  ): string {
    const firstName = contact.name.trim().split(/\s+/)[0] ?? contact.name;
    const fieldMap: Record<string, string> = {
      name: contact.name,
      firstName,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
    };
    return fieldMap[field] ?? '';
  }

  private buildTemplateComponents(
    campaign: ProspectCampaign,
    contact: { name: string; phone: string; email?: string },
  ): WhatsAppTemplateComponent[] {
    const mapping = campaign.templateVariableMapping ?? {};
    const sortedKeys = Object.keys(mapping).sort(
      (a, b) => Number(a) - Number(b),
    );

    if (sortedKeys.length === 0) return [];

    return [
      {
        type: 'body',
        parameters: sortedKeys.map((key) => ({
          type: 'text',
          text: this.resolveContactField(contact, mapping[key]),
        })),
      },
    ];
  }
}
