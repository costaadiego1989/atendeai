import { NotFoundException } from '@nestjs/common';
import { ITenantRepository } from '@modules/tenant/domain/repositories/ITenantRepository';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { CreateProspectCampaignUseCase } from '../application/use-cases/CreateProspectCampaignUseCase';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Prospecting Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner Prospecting',
        email: Email.create('owner@prospecting.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('CreateProspectCampaignUseCase', () => {
  let useCase: CreateProspectCampaignUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };

    campaignRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    useCase = new CreateProspectCampaignUseCase(
      tenantRepository,
      campaignRepository,
      new ProspectDispatchPolicy(),
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

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
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      name: 'Lista VIP',
      objective: 'Ativar leads premium',
      audienceType: 'CONTACT_LIST',
      channel: 'WHATSAPP',
      targetContactIds: ['contact-1', 'contact-1', 'contact-2'],
      messageTemplate: 'Oi {{first_name}}, temos uma condição especial para voce.',
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
        tenantId: tenant.id.toString(),
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
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
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
