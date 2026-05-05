import { NotFoundException } from '@nestjs/common';
import { DeletePromotionUseCase } from '../application/use-cases/DeletePromotionUseCase';
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
import { TenantAuditService } from '../application/services/TenantAuditService';

describe('DeletePromotionUseCase', () => {
  let useCase: DeletePromotionUseCase;
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
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      exists: jest.fn(),
    };
    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    useCase = new DeletePromotionUseCase(tenantRepository, tenantAuditService);
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
        promotionId: 'missing-promotion',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should remove the selected promotion', async () => {
    const tenant = makeTenant();
    const promotionId = tenant.promotions[0].id;
    tenantRepository.findById.mockResolvedValue(tenant);

    await useCase.execute({
      tenantId: tenant.id.toValue(),
      promotionId,
    });

    expect(tenant.promotions).toHaveLength(0);
    expect(tenantRepository.save).toHaveBeenCalledWith(tenant);
  });
});
