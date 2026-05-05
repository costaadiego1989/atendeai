import { TenantId } from '@shared/domain/TenantId';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ImportProspectLeadCapturesUseCase } from '../application/use-cases/ImportProspectLeadCapturesUseCase';
import { ProspectLeadCapture } from '../domain/entities/ProspectLeadCapture';
import { IProspectLeadCaptureRepository } from '../domain/repositories/IProspectLeadCaptureRepository';

describe('ImportProspectLeadCapturesUseCase', () => {
  let useCase: ImportProspectLeadCapturesUseCase;
  let leadCaptureRepository: jest.Mocked<IProspectLeadCaptureRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;

  beforeEach(() => {
    leadCaptureRepository = {
      saveMany: jest.fn(),
      findAllByTenant: jest.fn(),
      findManyByIds: jest.fn(),
    };
    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn(),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
    };

    useCase = new ImportProspectLeadCapturesUseCase(
      leadCaptureRepository,
      contactFacade,
    );
  });

  it('should import new leads, reuse existing contacts and skip leads without phone', async () => {
    const tenantId = 'tenant-ads-import';
    const importedLead = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-import',
      campaignName: 'Orto Ads',
      fullName: 'Ana Lead',
      phone: '5521999991111',
      email: 'ana@lead.test',
      submissionAt: new Date('2026-04-02T10:00:00.000Z'),
    });
    const reusedLead = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-reuse',
      campaignName: 'Orto Ads',
      fullName: 'Bruno Lead',
      phone: '5521999992222',
      email: 'bruno@lead.test',
      submissionAt: new Date('2026-04-02T11:00:00.000Z'),
    });
    const skippedLead = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-skip',
      campaignName: 'Orto Ads',
      fullName: 'Carla Lead',
      submissionAt: new Date('2026-04-02T12:00:00.000Z'),
    });

    leadCaptureRepository.findManyByIds.mockResolvedValue([
      importedLead,
      reusedLead,
      skippedLead,
    ]);
    contactFacade.upsertProspectContact
      .mockResolvedValueOnce({ contactId: 'contact-new', created: true })
      .mockResolvedValueOnce({ contactId: 'contact-existing', created: false });

    const result = await useCase.execute({
      tenantId,
      leadIds: ['lead-import', 'lead-reuse', 'lead-skip'],
    });

    expect(contactFacade.upsertProspectContact).toHaveBeenCalledTimes(2);
    expect(contactFacade.upsertProspectContact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tags: expect.arrayContaining([
          'prospecting',
          'source:google_ads',
          'temperature:cold',
          'campaign:Orto Ads',
        ]),
      }),
    );
    expect(importedLead.importStatus).toBe('IMPORTED');
    expect(reusedLead.importStatus).toBe('REUSED');
    expect(skippedLead.importStatus).toBe('SKIPPED_NO_PHONE');
    expect(leadCaptureRepository.saveMany).toHaveBeenCalledWith([
      importedLead,
      reusedLead,
      skippedLead,
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        importedCount: 1,
        reusedExistingContacts: 1,
        skippedMissingPhone: 1,
      }),
    );
    expect(result.importedContacts).toEqual([
      expect.objectContaining({
        id: 'contact-new',
        name: 'Ana Lead',
      }),
    ]);
  });
});
