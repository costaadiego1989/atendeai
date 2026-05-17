import { TenantId } from '@shared/domain/TenantId';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { IContactRepository } from '@modules/contact/domain/repositories/IContactRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { HandleMetaQualityEventUseCase } from '../application/use-cases/HandleMetaQualityEventUseCase';

function makeCampaign() {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Test Campaign',
    objective: 'Test',
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: ['contact-1'],
    messageTemplate: 'Oi {{first_name}}',
    templateName: 'atendeai_outbound_v1',
  });
  campaign.activate();
  return campaign;
}

function makeExecution(campaign: ProspectCampaign) {
  return ProspectExecution.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactId: 'contact-1',
    channel: campaign.channel,
  });
}

describe('HandleMetaQualityEventUseCase', () => {
  let useCase: HandleMetaQualityEventUseCase;
  let contactRepository: jest.Mocked<IContactRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;

  beforeEach(() => {
    contactRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
      findAllByPhone: jest.fn(),
    };

    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn(),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
      markProspectingOptOut: jest.fn().mockResolvedValue(undefined),
    };

    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
      findLastContactedAt: jest.fn(),
      findLatestByContactIds: jest.fn(),
      findActiveByContact: jest.fn().mockResolvedValue([]),
      countContactedTodayByCampaign: jest.fn().mockResolvedValue(0),
    };

    useCase = new HandleMetaQualityEventUseCase(
      contactRepository,
      contactFacade,
      executionRepository,
    );
  });

  it('marks opt-out and stops active executions when contact found', async () => {
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);

    contactRepository.findAllByPhone.mockResolvedValue([
      { tenantId: campaign.tenantId.toString(), contactId: 'contact-1' },
    ]);
    executionRepository.findActiveByContact.mockResolvedValue([execution]);

    const result = await useCase.execute({ phone: '11999998888' });

    expect(contactFacade.markProspectingOptOut).toHaveBeenCalledWith(
      campaign.tenantId.toString(),
      'contact-1',
    );
    expect(executionRepository.save).toHaveBeenCalledWith(execution);
    expect(execution.status.value).toBe('STOPPED');
    expect(execution.stopReason?.value).toBe('OPT_OUT');
    expect(result.processed).toBe(1);
  });

  it('returns processed: 0 and does nothing when contact not found', async () => {
    contactRepository.findAllByPhone.mockResolvedValue([]);

    const result = await useCase.execute({ phone: '99999999999' });

    expect(contactFacade.markProspectingOptOut).not.toHaveBeenCalled();
    expect(executionRepository.save).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  it('marks opt-out without stopping executions when no active executions exist', async () => {
    contactRepository.findAllByPhone.mockResolvedValue([
      { tenantId: '123e4567-e89b-12d3-a456-426614174000', contactId: 'contact-1' },
    ]);
    executionRepository.findActiveByContact.mockResolvedValue([]);

    const result = await useCase.execute({ phone: '11999998888' });

    expect(contactFacade.markProspectingOptOut).toHaveBeenCalled();
    expect(executionRepository.save).not.toHaveBeenCalled();
    expect(result.processed).toBe(1);
  });

  it('normalizes phone by stripping non-digit characters', async () => {
    contactRepository.findAllByPhone.mockResolvedValue([]);

    await useCase.execute({ phone: '+55 (11) 99999-8888' });

    expect(contactRepository.findAllByPhone).toHaveBeenCalledWith('5511999998888');
  });

  it('processes multiple tenants for same phone number', async () => {
    contactRepository.findAllByPhone.mockResolvedValue([
      { tenantId: 'tenant-a', contactId: 'contact-a' },
      { tenantId: 'tenant-b', contactId: 'contact-b' },
    ]);
    executionRepository.findActiveByContact.mockResolvedValue([]);

    const result = await useCase.execute({ phone: '11999998888' });

    expect(contactFacade.markProspectingOptOut).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
  });
});
