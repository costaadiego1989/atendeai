import { EntityNotFoundException, ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { PauseProspectCampaignUseCase } from '../application/use-cases/PauseProspectCampaignUseCase';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';

function makeActiveCampaign() {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha de pausa',
    objective: 'Pausar o fluxo',
    audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    messageTemplate: 'Template inicial',
  });
  campaign.activate();
  return campaign;
}

describe('PauseProspectCampaignUseCase', () => {
  let useCase: PauseProspectCampaignUseCase;
  let repository: jest.Mocked<IProspectCampaignRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    useCase = new PauseProspectCampaignUseCase(repository);
  });

  it('should pause an active campaign and persist the change', async () => {
    const campaign = makeActiveCampaign();
    repository.findById.mockResolvedValue(campaign);

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      campaignId: campaign.id.toString(),
    });

    expect(repository.save).toHaveBeenCalledWith(campaign);
    expect(result.status).toBe('PAUSED');
  });

  it('should throw when the campaign is not found in the tenant scope', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        campaignId: 'missing-campaign',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should reject invalid pause transitions', async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Campanha em draft',
      objective: 'Ainda não pode pausar',
      audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      messageTemplate: 'Template inicial',
    });
    repository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
