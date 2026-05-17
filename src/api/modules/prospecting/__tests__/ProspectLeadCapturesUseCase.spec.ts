import { TenantId } from '@shared/domain/TenantId';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ProspectLeadCapturesUseCase } from '../application/use-cases/ProspectLeadCapturesUseCase';
import { ProspectLeadCapture } from '../domain/entities/ProspectLeadCapture';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { IProspectLeadCaptureRepository } from '../domain/repositories/IProspectLeadCaptureRepository';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';

describe('ProspectLeadCapturesUseCase', () => {
  let useCase: ProspectLeadCapturesUseCase;
  let leadCaptureRepository: jest.Mocked<IProspectLeadCaptureRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;

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
    campaignRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
    };

    useCase = new ProspectLeadCapturesUseCase(
      leadCaptureRepository,
      contactFacade,
      campaignRepository,
      executionRepository,
      new ProspectDispatchPolicy(),
    );
  });

  it('should create a campaign queue only for actionable leads', async () => {
    const tenantId = 'tenant-ads-prospect';
    const leadA = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-a',
      campaignName: 'Google Ads Abril',
      fullName: 'Ana Lead',
      phone: '5521999991111',
      email: 'ana@lead.test',
      submissionAt: new Date('2026-04-02T10:00:00.000Z'),
    });
    const leadB = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-b',
      campaignName: 'Google Ads Abril',
      fullName: 'Bruno Lead',
      phone: '5521999992222',
      email: 'bruno@lead.test',
      submissionAt: new Date('2026-04-02T11:00:00.000Z'),
    });
    const leadSkipped = ProspectLeadCapture.create({
      tenantId: TenantId.create(tenantId),
      externalLeadId: 'lead-c',
      campaignName: 'Google Ads Abril',
      fullName: 'Carla Lead',
      submissionAt: new Date('2026-04-02T12:00:00.000Z'),
    });

    leadCaptureRepository.findManyByIds.mockResolvedValue([
      leadA,
      leadB,
      leadSkipped,
    ]);
    contactFacade.upsertProspectContact
      .mockResolvedValueOnce({ contactId: 'contact-a', created: true })
      .mockResolvedValueOnce({ contactId: 'contact-b', created: false });

    const result = await useCase.execute({
      tenantId,
      leadIds: ['lead-a', 'lead-b', 'lead-c'],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
      channel: 'WHATSAPP',
    });

    const savedExecutions = executionRepository.saveMany.mock.calls[0][0];
    expect(contactFacade.upsertProspectContact).toHaveBeenCalledTimes(2);
    expect(campaignRepository.save).toHaveBeenCalledTimes(1);
    expect(executionRepository.saveMany).toHaveBeenCalledTimes(1);
    expect(savedExecutions).toHaveLength(2);
    expect(leadSkipped.importStatus).toBe('SKIPPED_NO_PHONE');
    expect(result).toEqual(
      expect.objectContaining({
        importedCount: 1,
        reusedExistingContacts: 1,
        skippedMissingPhone: 1,
        dispatchedExecutions: 0,
        targetContactIds: ['contact-a', 'contact-b'],
      }),
    );
  });
});
