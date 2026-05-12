import { NotFoundException } from '@nestjs/common';
import { AddPromotionUseCase } from '../application/use-cases/AddPromotionUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { Promotion } from '../domain/value-objects/Promotion';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { TenantAuditService } from '../application/services/TenantAuditService';

describe('AddPromotionUseCase', () => {
  let useCase: AddPromotionUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;

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
    userRepository = {
      saveWithTenant: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndTenant: jest.fn(),
      findByEmail: jest.fn(),
      findAllByTenant: jest.fn(),
      findOwnerPrincipalByTenantId: jest.fn(),
      delete: jest.fn(),
    };
    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    useCase = new AddPromotionUseCase(
      tenantRepository,
      userRepository,
      tenantAuditService,
    );
  });

  function makeTenant() {
    return Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('11.222.333/0001-81'),
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
      promotions: [
        Promotion.create({
          title: 'Promo antiga',
          description: 'Descrição da promo antiga',
          value: '10%',
        }),
      ],
    });
  }

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        title: 'Nova promo',
        description: 'Descrição da nova promoção',
        value: '20%',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should append promotions without removing the existing ones', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    userRepository.findByIdAndTenant.mockResolvedValue(tenant.users[0]);

    await useCase.execute({
      tenantId: tenant.id.toValue(),
      title: 'Nova promo',
      description: 'Descrição da nova promoção',
      value: '20%',
      imageUrl: 'https://img.test/promo.png',
      expiresAt: '2026-05-31',
      assignedUserId: tenant.users[0]?.id.toValue(),
    });

    expect(tenant.promotions).toHaveLength(2);
    expect(tenant.promotions[0]?.title).toBe('Promo antiga');
    expect(tenant.promotions[1]?.title).toBe('Nova promo');
    expect(tenant.promotions[1]?.expiresAt).toBe('2026-05-31');
    expect(tenant.promotions[1]?.assignedUserName).toBe('Owner Name');
    expect(tenantRepository.save).toHaveBeenCalledWith(tenant);
  });
});
