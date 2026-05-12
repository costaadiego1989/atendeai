import { NotFoundException } from '@nestjs/common';
import { GetTenantSettingsUseCase } from '../application/use-cases/GetTenantSettingsUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { ITenantAuditLogRepository } from '../application/ports/ITenantAuditLogRepository';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';

describe('GetTenantSettingsUseCase', () => {
  let useCase: GetTenantSettingsUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let tenantAuditLogRepository: jest.Mocked<ITenantAuditLogRepository>;
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
    tenantAuditLogRepository = {
      record: jest.fn(),
      listRecent: jest.fn(),
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

    useCase = new GetTenantSettingsUseCase(
      tenantRepository,
      tenantAuditLogRepository,
      tenantModuleAccessService,
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);
    tenantAuditLogRepository.listRecent.mockResolvedValue([]);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return segmented settings data with explicit owner', async () => {
    const owner = User.create({
      name: 'Ana Souza',
      email: Email.create('ana@aurora.com'),
      phone: Phone.create('11999998888'),
      passwordHash: 'hash',
      role: Role.create('OWNER'),
    });

    const tenant = Tenant.create({
      companyName: CompanyName.create('Clinica Aurora'),
      cnpj: CNPJ.create('11.444.777/0001-61'),
      plan: Plan.create('ESSENCIAL'),
      users: [owner],
    });

    tenant.updateBusinessData({
      businessType: 'CLINIC',
      ownerBirthDate: '1989-05-30',
      description: 'Clinica odontologica focada em clareamento.',
      services: 'Clareamento, limpeza',
      catalogUrl: 'https://empresa.test/catalogo',
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
      },
    });

    tenantRepository.findById.mockResolvedValue(tenant);
    tenantAuditLogRepository.listRecent.mockResolvedValue([
      {
        id: 'audit-1',
        tenantId: tenant.id.toValue(),
        eventType: 'BUSINESS_DATA_UPDATED',
        email: 'ana@aurora.com',
        metadata: { updatedFields: ['businessType'] },
        createdAt: new Date('2026-04-09T10:00:00.000Z'),
      },
    ]);

    const result = await useCase.execute(tenant.id.toValue());

    expect(result.support.tenantId).toBe(tenant.id.toValue());
    expect(result.company.companyName).toBe('Clinica Aurora');
    expect(result.company.businessType).toBe('CLINIC');
    expect(result.owner?.id).toBe(owner.id.toValue());
    expect(result.owner?.birthDate).toBe('1989-05-30');
    expect(result.recentAuditLogs).toHaveLength(1);
    expect(result.recentAuditLogs[0]?.eventType).toBe('BUSINESS_DATA_UPDATED');
    expect(result.operatingHours).toEqual({
      monday: { open: '08:00', close: '18:00' },
    });
  });
});
