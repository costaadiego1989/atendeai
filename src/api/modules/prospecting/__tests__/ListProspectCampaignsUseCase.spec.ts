import { ListProspectCampaignsUseCase } from '../application/use-cases/ListProspectCampaignsUseCase';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';

function makeCampaign(
  tenantId: string,
  name: string,
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST',
  targetContactIds?: string[],
) {
  return ProspectCampaign.create({
    tenantId: TenantId.create(tenantId),
    name,
    objective: `${name} objective`,
    audienceType: ProspectAudienceTypeVO.create(audienceType),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds,
    dailyLimit: 15,
    messageTemplate: `Template for ${name}`,
  });
}

describe('ListProspectCampaignsUseCase', () => {
  let useCase: ListProspectCampaignsUseCase;
  let repository: jest.Mocked<IProspectCampaignRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    useCase = new ListProspectCampaignsUseCase(repository);
  });

  it('should return the campaigns mapped for the tenant', async () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    repository.findAllByTenant.mockResolvedValue([
      makeCampaign(tenantId, 'Reativação', 'REENGAGEMENT'),
      makeCampaign(tenantId, 'Lista VIP', 'CONTACT_LIST', [
        'contact-1',
        'contact-2',
      ]),
    ]);

    const result = await useCase.execute({ tenantId });

    expect(repository.findAllByTenant).toHaveBeenCalledWith(tenantId);
    expect(result).toEqual([
      expect.objectContaining({
        name: 'Reativação',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
        status: 'DRAFT',
      }),
      expect.objectContaining({
        name: 'Lista VIP',
        audienceType: 'CONTACT_LIST',
        targetContactIds: ['contact-1', 'contact-2'],
      }),
    ]);
  });

  it('should return an empty list when the tenant has no campaigns', async () => {
    repository.findAllByTenant.mockResolvedValue([]);

    await expect(
      useCase.execute({ tenantId: '123e4567-e89b-12d3-a456-426614174000' }),
    ).resolves.toEqual([]);
  });
});
