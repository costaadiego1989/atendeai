import { TenantId } from '@shared/domain/TenantId';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';
import {
  ProspectCooldownActiveError,
  ProspectNoWhatsAppPhoneError,
  ProspectOptOutError,
} from '../domain/errors/ProspectingErrors';

function makeCampaign(opts: { cooldownDays?: number; channel?: 'WHATSAPP' | 'INSTAGRAM' } = {}) {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha outbound',
    objective: 'Enviar primeiro toque',
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create(opts.channel ?? 'WHATSAPP'),
    targetContactIds: ['contact-1'],
    messageTemplate: 'Oi {{first_name}}, tudo bem?',
    templateName: 'atendeai_outbound_v1',
    cooldownDays: opts.cooldownDays ?? 30,
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

function makeContact(overrides: Partial<{ phone: string; prospectingOptOut: boolean }> = {}) {
  return {
    phone: '11999998888',
    prospectingOptOut: false,
    ...overrides,
  };
}

function makeRepo(lastContactedAt: Date | null = null): jest.Mocked<IProspectExecutionRepository> {
  return {
    save: jest.fn(),
    saveMany: jest.fn(),
    findById: jest.fn(),
    findLatestContactedByContact: jest.fn(),
    findAllByCampaign: jest.fn(),
    findNextPendingByCampaign: jest.fn(),
    findLastContactedAt: jest.fn().mockResolvedValue(lastContactedAt),
    findLatestByContactIds: jest.fn().mockResolvedValue([]),
    findActiveByContact: jest.fn().mockResolvedValue([]),
    countContactedTodayByCampaign: jest.fn().mockResolvedValue(0),
  };
}

describe('ProspectDispatchPolicy.assertContactEligible', () => {
  it('passes when contact is eligible', async () => {
    const repo = makeRepo(null);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact()),
    ).resolves.toBeUndefined();
  });

  it('throws ProspectOptOutError when contact opted out', async () => {
    const repo = makeRepo(null);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact({ prospectingOptOut: true })),
    ).rejects.toThrow(ProspectOptOutError);

    expect(repo.findLastContactedAt).not.toHaveBeenCalled();
  });

  it('throws ProspectNoWhatsAppPhoneError when WHATSAPP campaign and phone is empty', async () => {
    const repo = makeRepo(null);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign({ channel: 'WHATSAPP' });
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact({ phone: '' })),
    ).rejects.toThrow(ProspectNoWhatsAppPhoneError);
  });

  it('does not throw NoWhatsAppPhoneError for INSTAGRAM campaign without phone', async () => {
    const repo = makeRepo(null);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign({ channel: 'INSTAGRAM' });
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact({ phone: '' })),
    ).resolves.toBeUndefined();
  });

  it('throws ProspectCooldownActiveError when last contact is within cooldown window', async () => {
    const recentContactDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const repo = makeRepo(recentContactDate);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign({ cooldownDays: 30 });
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact()),
    ).rejects.toThrow(ProspectCooldownActiveError);
  });

  it('passes when last contact is outside cooldown window', async () => {
    const oldContactDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
    const repo = makeRepo(oldContactDate);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign({ cooldownDays: 30 });
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact()),
    ).resolves.toBeUndefined();
  });

  it('opt-out check runs before cooldown query', async () => {
    const repo = makeRepo(null);
    const policy = new ProspectDispatchPolicy(repo);
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);

    await expect(
      policy.assertContactEligible(campaign, execution, makeContact({ prospectingOptOut: true })),
    ).rejects.toThrow(ProspectOptOutError);

    expect(repo.findLastContactedAt).not.toHaveBeenCalled();
  });
});
