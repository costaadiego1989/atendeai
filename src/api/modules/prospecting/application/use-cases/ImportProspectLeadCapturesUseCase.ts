import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IImportProspectLeadCapturesUseCase,
  ImportProspectLeadCapturesInput,
  ImportProspectLeadCapturesOutput,
} from './interfaces/IImportProspectLeadCapturesUseCase';
import {
  IProspectLeadCaptureRepository,
  PROSPECT_LEAD_CAPTURE_REPOSITORY,
} from '../../domain/repositories/IProspectLeadCaptureRepository';

@Injectable()
export class ImportProspectLeadCapturesUseCase
  implements IImportProspectLeadCapturesUseCase
{
  constructor(
    @Inject(PROSPECT_LEAD_CAPTURE_REPOSITORY)
    private readonly leadCaptureRepository: IProspectLeadCaptureRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    input: ImportProspectLeadCapturesInput,
  ): Promise<ImportProspectLeadCapturesOutput> {
    const leads = await this.leadCaptureRepository.findManyByIds(
      input.tenantId,
      input.leadIds,
    );

    if (!leads.length) {
      throw new ValidationErrorException('No selected Google Ads leads were found');
    }

    let importedCount = 0;
    let reusedExistingContacts = 0;
    let skippedMissingPhone = 0;
    const importedContacts: ImportProspectLeadCapturesOutput['importedContacts'] = [];

    for (const lead of leads) {
      if (!lead.phone) {
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
        notes: this.buildNotes(lead),
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
        importedContacts.push({
          id: result.contactId,
          name: lead.fullName || 'Lead Google Ads',
          phone: lead.phone,
          email: lead.email,
        });
      } else {
        reusedExistingContacts += 1;
        lead.markReused(result.contactId);
      }
    }

    await this.leadCaptureRepository.saveMany(leads);

    return {
      importedCount,
      reusedExistingContacts,
      skippedMissingPhone,
      importedContacts,
    };
  }

  private buildNotes(lead: {
    campaignName?: string;
    formName?: string;
    city?: string;
    state?: string;
    interests?: Record<string, unknown>;
  }) {
    return [
      'Lead captado via Google Ads',
      lead.campaignName ? `Campanha: ${lead.campaignName}` : undefined,
      lead.formName ? `Formulario: ${lead.formName}` : undefined,
      lead.city ? `Cidade: ${lead.city}${lead.state ? `/${lead.state}` : ''}` : undefined,
      lead.interests ? `Interesses: ${JSON.stringify(lead.interests)}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');
  }
}
