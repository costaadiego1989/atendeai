import { NotFoundException } from '@nestjs/common';
import { ITenantFacade } from '@modules/tenant/application/facades/ITenantFacade';
import { CreateProspectCampaignUseCase } from '../application/use-cases/CreateProspectCampaignUseCase';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';

const TENANT_ID = 'f0e9c8b0-4f78-4a1c-bb62-1d67ad55a111';

describe('CreateProspectCampaignUseCase', () => {
  let useCase: CreateProspectCampaignUseCase;
  let tenantFacade: jest.Mocked<Pick<ITenantFacade, 'tenantExists'>>;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;

  beforeEach(() => {
    tenantFacade = {
      tenantExists: jest.fn().mockResolvedValue(true),
    };

    campaignRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    useCase = new CreateProspectCampaignUseCase(
      tenantFacade as any,
      campaignRepository,
      new ProspectDispatchPolicy({} as any),
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantFacade.tenantExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        name: 'Reativação',
        objective: 'Retomar conversa',
        audienceType: 'REENGAGEMENT',
        channel: 'WHATSAPP',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create and persist a draft campaign', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      name: 'Lista VIP',
      objective: 'Ativar leads premium',
      audienceType: 'CONTACT_LIST',
      channel: 'WHATSAPP',
      targetContactIds: ['contact-1', 'contact-1', 'contact-2'],
      messageTemplate:
        'Oi {{first_name}}, temos uma condição especial para voce.',
      dailyLimit: 30,
    });

    expect(campaignRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lista VIP',
        objective: 'Ativar leads premium',
        dailyLimit: 30,
        targetContactIds: ['contact-1', 'contact-2'],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tenantId: TENANT_ID,
        name: 'Lista VIP',
        status: 'DRAFT',
        audienceType: 'CONTACT_LIST',
        channel: 'WHATSAPP',
        targetContactIds: ['contact-1', 'contact-2'],
        dailyLimit: 30,
      }),
    );
  });

  it('should allow creating instagram prospect campaigns', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      name: 'Instagram Revival',
      objective: 'Retomar pelo direct',
      audienceType: 'REENGAGEMENT',
      channel: 'INSTAGRAM',
      messageTemplate: 'Oi {{first_name}}, podemos retomar por aqui?',
    });

    expect(campaignRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Instagram Revival',
        channel: expect.objectContaining({ value: 'INSTAGRAM' }),
      }),
    );
    expect(result.channel).toBe('INSTAGRAM');
  });
});
