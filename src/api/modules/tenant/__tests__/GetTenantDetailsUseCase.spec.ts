import { NotFoundException } from '@nestjs/common';
import { GetTenantDetailsUseCase } from '../application/use-cases/GetTenantDetailsUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { CPF } from '@shared/domain/CPF';
import { Address } from '../domain/value-objects/Address';
import { Promotion } from '../domain/value-objects/Promotion';

describe('GetTenantDetailsUseCase', () => {
  let useCase: GetTenantDetailsUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let tenantModuleAccessService: jest.Mocked<TenantModuleAccessService>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      exists: jest.fn(),
    };

    tenantModuleAccessService = {
      getSummary: jest.fn().mockResolvedValue({
        subscriptionId: null,
        plan: null,
        status: null,
        pricing: {
          baseMonthlyPrice: 0,
          addonsMonthlyPrice: 0,
          totalMonthlyPrice: 0,
          pricingVersion: null,
        },
        includedModules: [],
        addonModules: [],
        enabledModules: [],
        moduleAccess: {},
      }),
    } as unknown as jest.Mocked<TenantModuleAccessService>;

    useCase = new GetTenantDetailsUseCase(
      tenantRepository,
      tenantModuleAccessService,
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return tenant details including owner, address and operating hours', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Clinica Aurora'),
      cnpj: CNPJ.create('11.444.777/0001-61'),
      plan: Plan.create('ESSENCIAL'),
      users: [
        User.create({
          name: 'Ana Souza',
          email: Email.create('ana@aurora.com'),
          cpf: CPF.create('529.982.247-25'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hash',
          role: Role.create('OWNER'),
        }),
      ],
    });

    tenant.updateBusinessData({
      businessType: 'CLINIC',
      ownerBirthDate: '1989-05-30',
      description: 'Clinica odontologica focada em clareamento e avaliação.',
      services: 'Clareamento, limpeza, avaliação',
      address: Address.create({
        zipcode: '01310-100',
        street: 'Av. Paulista, 1000',
        streetNumber: '1000',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
      }),
      catalogUrl: 'https://empresa.test/catalogo',
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
        saturday: { open: '08:00', close: '12:00' },
      },
      promotions: [
        Promotion.create({
          title: 'Campanha premium',
          description: 'Oferta para novos pacientes do mes de abril.',
          value: '15%',
          expiresAt: '2026-04-30',
          assignedUserId: tenant.users[0]?.id.toValue(),
          assignedUserName: tenant.users[0]?.name,
        }),
      ],
    });

    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute(tenant.id.toValue());

    expect(result.companyName).toBe('Clinica Aurora');
    expect(result.cnpj).toBe('11.444.777/0001-61');
    expect(result.owner?.cpf).toBe('529.982.247-25');
    expect(result.owner?.birthDate).toBe('1989-05-30');
    expect(result.address).toEqual({
      zipcode: '01310-100',
      street: 'Av. Paulista, 1000',
      streetNumber: '1000',
      neighborhood: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
    });
    expect(result.operatingHours).toEqual({
      monday: { open: '08:00', close: '18:00' },
      saturday: { open: '08:00', close: '12:00' },
    });
    expect(result.promotions).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        title: 'Campanha premium',
        value: '15%',
        expiresAt: '2026-04-30',
        assignedUserName: 'Ana Souza',
      }),
    ]);
  });
});
