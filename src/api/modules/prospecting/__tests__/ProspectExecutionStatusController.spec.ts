import { TenantId } from '@shared/domain/TenantId';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { ProspectExecutionController } from '../presentation/controllers/ProspectExecutionController';
import { IDispatchProspectExecutionUseCase } from '../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';

function makeCampaign() {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Test Campaign',
    objective: 'Test',
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: ['contact-1', 'contact-2'],
    messageTemplate: 'Oi {{first_name}}',
    templateName: 'atendeai_outbound_v1',
  });
  campaign.activate();
  return campaign;
}

function makeExecution(campaign: ProspectCampaign, contactId: string) {
  return ProspectExecution.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactId,
    channel: campaign.channel,
  });
}

describe('ProspectExecutionController — GET /status', () => {
  let controller: ProspectExecutionController;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;
  let dispatchUseCase: jest.Mocked<IDispatchProspectExecutionUseCase>;

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';
  const req = { user: { tenantId } };

  beforeEach(() => {
    dispatchUseCase = { execute: jest.fn() } as any;
    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
      findLastContactedAt: jest.fn(),
      findLatestByContactIds: jest.fn(),
      findActiveByContact: jest.fn(),
      countContactedTodayByCampaign: jest.fn(),
    };

    controller = new ProspectExecutionController(
      dispatchUseCase,
      executionRepository,
    );
  });

  it('returns NONE for contacts with no execution', async () => {
    executionRepository.findLatestByContactIds.mockResolvedValue([]);

    const result = await controller.getStatus(req, 'contact-1,contact-2');

    expect(result).toEqual([
      { contactId: 'contact-1', status: 'NONE', lastContactedAt: null, stopReason: null, campaignName: null },
      { contactId: 'contact-2', status: 'NONE', lastContactedAt: null, stopReason: null, campaignName: null },
    ]);
  });

  it('returns status for contacts with executions and NONE for missing ones', async () => {
    const now = new Date();
    executionRepository.findLatestByContactIds.mockResolvedValue([
      { contactId: 'contact-1', status: 'CONTACTED', updatedAt: now, stopReason: null, campaignName: 'Test Campaign' },
    ]);

    const result = await controller.getStatus(req, 'contact-1,contact-2');

    expect(result).toEqual([
      { contactId: 'contact-1', status: 'CONTACTED', lastContactedAt: now, stopReason: null, campaignName: 'Test Campaign' },
      { contactId: 'contact-2', status: 'NONE', lastContactedAt: null, stopReason: null, campaignName: null },
    ]);
  });

  it('returns stopReason when execution is stopped', async () => {
    const now = new Date();
    executionRepository.findLatestByContactIds.mockResolvedValue([
      { contactId: 'contact-1', status: 'STOPPED', updatedAt: now, stopReason: 'OPT_OUT', campaignName: 'Campanha' },
    ]);

    const result = await controller.getStatus(req, 'contact-1');

    expect(result[0].status).toBe('STOPPED');
    expect(result[0].stopReason).toBe('OPT_OUT');
  });

  it('returns empty array when no contactIds provided', async () => {
    const result = await controller.getStatus(req, '');
    expect(result).toEqual([]);
    expect(executionRepository.findLatestByContactIds).not.toHaveBeenCalled();
  });

  it('scopes query by tenantId from JWT', async () => {
    executionRepository.findLatestByContactIds.mockResolvedValue([]);

    await controller.getStatus(req, 'contact-1');

    expect(executionRepository.findLatestByContactIds).toHaveBeenCalledWith(
      tenantId,
      ['contact-1'],
    );
  });
});
