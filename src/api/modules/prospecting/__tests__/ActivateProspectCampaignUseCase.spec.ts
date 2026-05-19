import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ActivateProspectCampaignUseCase } from '../application/use-cases/ActivateProspectCampaignUseCase';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';

function makeCampaign() {
  return ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha de ativação',
    objective: 'Ativar o fluxo',
    audienceType: ProspectAudienceTypeVO.create('REENGAGEMENT'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    messageTemplate: 'Template inicial',
    templateName: 'ativacao_template',
  });
}

describe('ActivateProspectCampaignUseCase', () => {
  let useCase: ActivateProspectCampaignUseCase;
  let repository: jest.Mocked<IProspectCampaignRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    useCase = new ActivateProspectCampaignUseCase(repository);
  });

  it('should activate a draft campaign and persist the change', async () => {
    const campaign = makeCampaign();
    repository.findById.mockResolvedValue(campaign);

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      campaignId: campaign.id.toString(),
    });

    expect(repository.save).toHaveBeenCalledWith(campaign);
    expect(result.status).toBe('ACTIVE');
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

  it('should reject invalid activation transitions', async () => {
    const campaign = makeCampaign();
    campaign.activate();
    repository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
