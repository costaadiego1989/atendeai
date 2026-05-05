import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { StartMetaInstagramConnectionUseCase } from '../application/use-cases/StartMetaInstagramConnectionUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { MetaInstagramOAuthService } from '../infrastructure/services/MetaInstagramOAuthService';
import { MetaInstagramOAuthStateService } from '../infrastructure/services/MetaInstagramOAuthStateService';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';

describe('StartMetaInstagramConnectionUseCase', () => {
  let useCase: StartMetaInstagramConnectionUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let oauthService: jest.Mocked<MetaInstagramOAuthService>;
  let stateService: jest.Mocked<MetaInstagramOAuthStateService>;

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
    } as any;

    oauthService = {
      buildAuthorizationUrl: jest.fn().mockReturnValue('https://meta.example.com/oauth'),
    } as any;

    stateService = {
      sign: jest.fn().mockReturnValue('signed-state'),
    } as any;

    useCase = new StartMetaInstagramConnectionUseCase(
      tenantRepository,
      oauthService,
      stateService,
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

  it('should start oauth for tenant scope', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
    });

    expect(stateService.sign).toHaveBeenCalledWith(tenant.id.toValue(), undefined);
    expect(oauthService.buildAuthorizationUrl).toHaveBeenCalledWith('signed-state');
    expect(result.authorizationUrl).toBe('https://meta.example.com/oauth');
  });

  it('should validate branch scope before starting oauth', async () => {
    const tenant = makeTenant();
    const branch = TenantBranch.create({
      tenantId: tenant.id.toValue(),
      name: 'Filial Centro',
      cnpj: null,
      phone: null,
      email: null,
      whatsappNumber: null,
      instagramAccountId: null,
      whatsAppConfigOverride: null,
      address: Address.create({
        zipcode: '22000-000',
        street: 'Rua A',
        streetNumber: '10',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
      }),
      operatingHours: null,
      isHeadquarters: false,
      active: true,
    });

    tenantRepository.findById.mockResolvedValue(tenant);
    tenantRepository.listBranches.mockResolvedValue([branch]);

    await useCase.execute({
      tenantId: tenant.id.toValue(),
      branchId: branch.id.toValue(),
    });

    expect(stateService.sign).toHaveBeenCalledWith(
      tenant.id.toValue(),
      branch.id.toValue(),
    );
  });

  it('should throw when tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: 'missing-tenant' }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
