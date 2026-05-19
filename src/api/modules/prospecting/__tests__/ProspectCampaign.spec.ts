import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';

describe('ProspectCampaign', () => {
  it('should create a draft reengagement campaign with sane defaults', () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Reativação de leads mornos',
      objective: 'Retomar contato com leads que esfriaram',
      audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
      channel: ProspectChannelVO.create('WHATSAPP'),
    });

    expect(campaign.status.value).toBe('DRAFT');
    expect(campaign.dailyLimit).toBe(50);
    expect(campaign.targetContactIds).toEqual([]);
  });

  it('should deduplicate target contacts for contact-list campaigns', () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Lista VIP',
      objective: 'Abordar lista importada',
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds: ['contact-1', 'contact-1', 'contact-2'],
      dailyLimit: 20,
    });

    expect(campaign.targetContactIds).toEqual(['contact-1', 'contact-2']);
    expect(campaign.dailyLimit).toBe(20);
  });

  it('should require target contacts when the audience is a contact list', () => {
    expect(() =>
      ProspectCampaign.create({
        tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
        name: 'Lista vazia',
        objective: 'Falhar sem contatos',
        audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
        channel: ProspectChannelVO.create('WHATSAPP'),
      }),
    ).toThrow(ValidationErrorException);
  });

  it('should allow valid status transitions between draft, active and paused', () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Reativação pausavel',
      objective: 'Testar transicoes',
      audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      templateName: 'reativacao_template',
    });

    campaign.activate();
    expect(campaign.status.value).toBe('ACTIVE');

    campaign.pause();
    expect(campaign.status.value).toBe('PAUSED');
  });
});
