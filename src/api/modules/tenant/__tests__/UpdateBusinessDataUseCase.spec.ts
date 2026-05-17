import { NotFoundException } from '@nestjs/common';
import { UpdateBusinessDataUseCase } from '../application/use-cases/UpdateBusinessDataUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { TenantAuditService } from '../application/services/TenantAuditService';

describe('UpdateBusinessDataUseCase', () => {
  let useCase: UpdateBusinessDataUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };

    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    useCase = new UpdateBusinessDataUseCase(
      tenantRepository,
      tenantAuditService,
    );
  });

  function makeTenant() {
    return Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('60.701.190/0001-04'),
      plan: Plan.create('ESSENCIAL'),
      users: [
        User.create({
          name: 'Owner Name',
          email: Email.create('owner@acme.com'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hashed-password',
          role: Role.create('OWNER'),
        }),
      ],
    });
  }

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update business fields and build the address object', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      ownerBirthDate: '1989-05-30',
      description: 'Venda de calcados',
      services: 'Atendimento por WhatsApp',
      zipcode: '01001-000',
      street: 'Rua A',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      catalogUrl: 'https://catalog.test',
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
      },
    });

    expect(result).toEqual({ success: true });
    expect(tenant.businessType).toBeNull();
    expect(tenant.ownerBirthDate).toBe('1989-05-30');
    expect(tenant.description).toBe('Venda de calcados');
    expect(tenant.address?.toValue()).toEqual({
      zipcode: '01001-000',
      street: 'Rua A',
      streetNumber: '',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
    });
    expect(tenantRepository.save).toHaveBeenCalledWith(tenant);
  });
});
