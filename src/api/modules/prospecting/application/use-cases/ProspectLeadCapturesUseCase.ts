import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../../domain/entities/ProspectExecution';
import { ProspectAudienceTypeVO } from '../../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../../domain/value-objects/ProspectChannel';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  IProspectLeadCaptureRepository,
  PROSPECT_LEAD_CAPTURE_REPOSITORY,
} from '../../domain/repositories/IProspectLeadCaptureRepository';
import { ProspectDispatchPolicy } from '../services/ProspectDispatchPolicy';
import {
  IProspectLeadCapturesUseCase,
  ProspectLeadCapturesInput,
  ProspectLeadCapturesOutput,
} from './interfaces/IProspectLeadCapturesUseCase';

@Injectable()
export class ProspectLeadCapturesUseCase implements IProspectLeadCapturesUseCase {
  constructor(
    @Inject(PROSPECT_LEAD_CAPTURE_REPOSITORY)
    private readonly leadCaptureRepository: IProspectLeadCaptureRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly campaignRepository: IProspectCampaignRepository,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
    private readonly dispatchPolicy: ProspectDispatchPolicy,
  ) {}

  async execute(
    input: ProspectLeadCapturesInput,
  ): Promise<ProspectLeadCapturesOutput> {
    if (!input.messageTemplate?.trim()) {
      throw new ValidationErrorException(
        'Prospect message template is required',
      );
    }
    this.dispatchPolicy.assertTemplateSupportsPersonalization(
      input.messageTemplate,
    );

    const channel = input.channel ?? 'WHATSAPP';
    const leads = await this.leadCaptureRepository.findManyByIds(
      input.tenantId,
      input.leadIds,
    );

    if (!leads.length) {
      throw new ValidationErrorException(
        'No selected Google Ads leads were found',
      );
    }

    let importedCount = 0;
    let reusedExistingContacts = 0;
    let skippedMissingPhone = 0;
    const targetContactIds: string[] = [];

    for (const lead of leads) {
      const hasCompatibleChannel =
        channel === 'INSTAGRAM' ? !!lead.instagramHandle : !!lead.phone;

      if (!hasCompatibleChannel || !lead.phone) {
        lead.markSkippedNoPhone();
        skippedMissingPhone += 1;
        continue;
      }

      const result = await this.contactFacade.upsertProspectContact({
        tenantId: input.tenantId,
        name: lead.fullName || lead.campaignName || 'Lead Google Ads',
        phone: lead.phone,
        document: lead.document,
        email: lead.email,
        notes: [
          'Lead captado via Google Ads',
          lead.campaignName ? `Campanha: ${lead.campaignName}` : undefined,
          lead.formName ? `Formulario: ${lead.formName}` : undefined,
        ]
          .filter(Boolean)
          .join(' | '),
        tags: [
          'prospecting',
          'source:google_ads',
          'temperature:cold',
          ...(lead.campaignName ? [`campaign:${lead.campaignName}`] : []),
        ],
      });

      if (result.created) {
        importedCount += 1;
        lead.markImported(result.contactId);
      } else {
        reusedExistingContacts += 1;
        lead.markReused(result.contactId);
      }

      targetContactIds.push(result.contactId);
    }

    await this.leadCaptureRepository.saveMany(leads);

    const uniqueTargetContactIds = [...new Set(targetContactIds)];
    if (!uniqueTargetContactIds.length) {
      throw new ValidationErrorException(
        'Selected leads did not produce any actionable contacts',
      );
    }

    const campaign = ProspectCampaign.create({
      tenantId: leads[0].tenantId,
      name: input.campaignName?.trim() || this.buildCampaignName(leads),
      objective: input.objective?.trim() || this.buildObjective(leads),
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create(channel),
      targetContactIds: uniqueTargetContactIds,
      messageTemplate: input.messageTemplate.trim(),
      dailyLimit: uniqueTargetContactIds.length,
    });
    campaign.activate();
    await this.campaignRepository.save(campaign);

    const executions = uniqueTargetContactIds.map((contactId) =>
      ProspectExecution.create({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        contactId,
        channel: campaign.channel,
      }),
    );

    await this.executionRepository.saveMany(executions);

    return {
      campaignId: campaign.id.toString(),
      importedCount,
      reusedExistingContacts,
      skippedMissingPhone,
      dispatchedExecutions: 0,
      targetContactIds: uniqueTargetContactIds,
    };
  }

  private buildCampaignName(
    leads: Array<{ campaignName?: string; fullName?: string }>,
  ) {
    const campaignName = leads[0]?.campaignName?.trim();
    return campaignName
      ? `Leads Google Ads - ${campaignName}`
      : `Leads Google Ads - ${leads.length} contatos`;
  }

  private buildObjective(
    leads: Array<{
      campaignName?: string;
      interests?: Record<string, unknown>;
    }>,
  ) {
    const campaignName = leads[0]?.campaignName?.trim();
    return campaignName
      ? `Trabalhar leads captados via Google Ads na campanha ${campaignName}`
      : 'Trabalhar leads captados via Google Ads';
  }
}
