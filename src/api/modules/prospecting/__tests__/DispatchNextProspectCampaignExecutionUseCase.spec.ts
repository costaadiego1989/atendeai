import { TenantId } from '@shared/domain/TenantId';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { IDispatchProspectExecutionUseCase } from '../application/use-cases/interfaces/IDispatchProspectExecutionUseCase';
import { IStartProspectCampaignUseCase } from '../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { IProspectDispatchQueue } from '../domain/ports/IProspectDispatchQueue';
import { DispatchNextProspectCampaignExecutionUseCase } from '../application/use-cases/DispatchNextProspectCampaignExecutionUseCase';

function makeCampaign(opts: {
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  dailyLimit?: number;
} = {}) {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha outbound',
    objective: 'Enviar primeiro toque',
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: ['contact-1', 'contact-2'],
    messageTemplate: 'Oi {{first_name}}, tudo bem?',
    templateName: 'atendeai_outbound_v1',
    minDelaySeconds: opts.minDelaySeconds ?? 30,
    maxDelaySeconds: opts.maxDelaySeconds ?? 120,
    dailyLimit: opts.dailyLimit ?? 50,
  });
  campaign.activate();
  return campaign;
}

function makeExecution(campaign: ProspectCampaign, contactId = 'contact-1') {
  return ProspectExecution.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactId,
    channel: campaign.channel,
  });
}

function makeDispatchResult(executionId: string) {
  return {
    executionId,
    conversationId: 'conv-1',
    messageId: 'msg-1',
    status: 'CONTACTED' as const,
    renderedMessage: 'Oi Maria, tudo bem?',
  };
}

function makeUseCase(
  campaign: ProspectCampaign | null,
  executions: ProspectExecution[],
  contactedTodayCount = 0,
) {
  const campaignRepository: jest.Mocked<IProspectCampaignRepository> = {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(campaign),
    findAllByTenant: jest.fn(),
  };

  const firstPending = executions.find((e) => e.status.value === 'PENDING') ?? null;
  const executionRepository: jest.Mocked<IProspectExecutionRepository> = {
    save: jest.fn(),
    saveMany: jest.fn(),
    findById: jest.fn(),
    findLatestContactedByContact: jest.fn(),
    findAllByCampaign: jest.fn().mockResolvedValue(executions),
    findNextPendingByCampaign: jest.fn().mockResolvedValue(firstPending),
    findLastContactedAt: jest.fn().mockResolvedValue(null),
    findLatestByContactIds: jest.fn().mockResolvedValue([]),
    findActiveByContact: jest.fn().mockResolvedValue([]),
    countContactedTodayByCampaign: jest.fn().mockResolvedValue(contactedTodayCount),
  };

  const dispatchExecutionUseCase: jest.Mocked<IDispatchProspectExecutionUseCase> = {
    execute: jest.fn().mockResolvedValue(
      firstPending ? makeDispatchResult(firstPending.id.toString()) : undefined,
    ),
  };

  const startCampaignUseCase: jest.Mocked<IStartProspectCampaignUseCase> = {
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const dispatchQueue: jest.Mocked<IProspectDispatchQueue> = {
    scheduleNextDispatch: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new DispatchNextProspectCampaignExecutionUseCase(
    campaignRepository,
    executionRepository,
    dispatchExecutionUseCase,
    startCampaignUseCase,
    dispatchQueue,
  );

  return { useCase, campaignRepository, executionRepository, dispatchExecutionUseCase, startCampaignUseCase, dispatchQueue };
}

describe('DispatchNextProspectCampaignExecutionUseCase', () => {
  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  it('throws EntityNotFoundException when campaign not found', async () => {
    const { useCase } = makeUseCase(null, []);

    await expect(
      useCase.execute({ tenantId, campaignId: 'missing-campaign' }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('throws ValidationErrorException when campaign is not active', async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create(tenantId),
      name: 'Draft',
      objective: 'Test',
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds: ['contact-1'],
      messageTemplate: 'Oi {{first_name}}',
      templateName: 'atendeai_outbound_v1',
    });
    const { useCase } = makeUseCase(campaign, []);

    await expect(
      useCase.execute({ tenantId, campaignId: campaign.id.toString() }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('throws ValidationErrorException when no pending executions remain after start attempt', async () => {
    const campaign = makeCampaign();
    const { useCase, executionRepository } = makeUseCase(campaign, []);
    executionRepository.findNextPendingByCampaign.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId, campaignId: campaign.id.toString() }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('dispatches next pending execution and returns result', async () => {
    const campaign = makeCampaign();
    const exec1 = makeExecution(campaign, 'contact-1');
    const { useCase, dispatchExecutionUseCase } = makeUseCase(campaign, [exec1], 1);

    const result = await useCase.execute({
      tenantId,
      campaignId: campaign.id.toString(),
    });

    expect(dispatchExecutionUseCase.execute).toHaveBeenCalledWith({
      tenantId,
      executionId: exec1.id.toString(),
    });
    expect(result.executionId).toBe(exec1.id.toString());
    expect(result.status).toBe('CONTACTED');
  });

  it('schedules next dispatch when remaining pending > 0 and under daily limit', async () => {
    const campaign = makeCampaign({ minDelaySeconds: 30, maxDelaySeconds: 120, dailyLimit: 50 });
    const exec1 = makeExecution(campaign, 'contact-1');
    const exec2 = makeExecution(campaign, 'contact-2');
    const { useCase, dispatchQueue, executionRepository } = makeUseCase(campaign, [exec1, exec2], 1);
    executionRepository.findAllByCampaign.mockResolvedValue([exec1, exec2]);

    await useCase.execute({ tenantId, campaignId: campaign.id.toString() });

    expect(dispatchQueue.scheduleNextDispatch).toHaveBeenCalledWith(
      { tenantId, campaignId: campaign.id.toString() },
      expect.any(Number),
    );
  });

  it('scheduled delay is within campaign min/max range', async () => {
    const campaign = makeCampaign({ minDelaySeconds: 60, maxDelaySeconds: 180 });
    const exec1 = makeExecution(campaign, 'contact-1');
    const exec2 = makeExecution(campaign, 'contact-2');
    const { useCase, dispatchQueue, executionRepository } = makeUseCase(campaign, [exec1, exec2], 1);
    executionRepository.findAllByCampaign.mockResolvedValue([exec1, exec2]);

    await useCase.execute({ tenantId, campaignId: campaign.id.toString() });

    const [, delayMs] = dispatchQueue.scheduleNextDispatch.mock.calls[0];
    expect(delayMs).toBeGreaterThanOrEqual(60 * 1000);
    expect(delayMs).toBeLessThanOrEqual(180 * 1000);
  });

  it('does NOT schedule next dispatch when no remaining pending executions', async () => {
    const campaign = makeCampaign();
    const exec1 = makeExecution(campaign, 'contact-1');
    // exec1 is PENDING when passed to makeUseCase — mock is set up with it as firstPending
    const { useCase, dispatchQueue, executionRepository } = makeUseCase(campaign, [exec1], 0);

    // Simulate post-dispatch state: exec1 is now CONTACTED, so 0 pending remain
    exec1.markAsContacted();
    executionRepository.findAllByCampaign.mockResolvedValue([exec1]);

    await useCase.execute({ tenantId, campaignId: campaign.id.toString() });

    expect(dispatchQueue.scheduleNextDispatch).not.toHaveBeenCalled();
  });

  it('does NOT schedule next dispatch when daily limit reached', async () => {
    const campaign = makeCampaign({ dailyLimit: 5 });
    const exec1 = makeExecution(campaign, 'contact-1');
    const exec2 = makeExecution(campaign, 'contact-2');
    const { useCase, dispatchQueue, executionRepository } = makeUseCase(campaign, [exec1, exec2], 5);
    executionRepository.findAllByCampaign.mockResolvedValue([exec1, exec2]);

    await useCase.execute({ tenantId, campaignId: campaign.id.toString() });

    expect(dispatchQueue.scheduleNextDispatch).not.toHaveBeenCalled();
  });

  it('returns remainingPendingExecutions count', async () => {
    const campaign = makeCampaign();
    const exec1 = makeExecution(campaign, 'contact-1');
    const exec2 = makeExecution(campaign, 'contact-2');
    const { useCase, executionRepository } = makeUseCase(campaign, [exec1, exec2], 1);
    executionRepository.findAllByCampaign.mockResolvedValue([exec1, exec2]);

    const result = await useCase.execute({
      tenantId,
      campaignId: campaign.id.toString(),
    });

    expect(result.remainingPendingExecutions).toBe(2);
  });
});
