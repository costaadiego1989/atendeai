import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { CompleteMetaInstagramConnectionUseCase } from '../application/use-cases/CompleteMetaInstagramConnectionUseCase';
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

describe('CompleteMetaInstagramConnectionUseCase', () => {
  let useCase: CompleteMetaInstagramConnectionUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let oauthService: jest.Mocked<MetaInstagramOAuthService>;
  let stateService: jest.Mocked<MetaInstagramOAuthStateService>;

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
    } as any;

    oauthService = {
      exchangeCodeForAccessToken: jest
        .fn()
        .mockResolvedValue('meta-access-token'),
      listInstagramAccounts: jest.fn().mockResolvedValue([
        {
          instagramAccountId: '17841400000000000',
          username: 'loja.acme',
          pageId: 'page-1',
          pageName: 'Loja Acme',
          profilePictureUrl: null,
        },
      ]),
    } as any;

    stateService = {
      verify: jest.fn().mockReturnValue({
        tenantId: 'tenant-1',
        branchId: null,
        issuedAt: Date.now(),
      }),
    } as any;

    useCase = new CompleteMetaInstagramConnectionUseCase(
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

  it('should return instagram accounts discovered in oauth callback', async () => {
    tenantRepository.findById.mockResolvedValue(makeTenant());

    const result = await useCase.execute({
      code: 'oauth-code',
      state: 'signed-state',
    });

    expect(stateService.verify).toHaveBeenCalledWith('signed-state');
    expect(oauthService.exchangeCodeForAccessToken).toHaveBeenCalledWith(
      'oauth-code',
      'tenant-1',
    );
    expect(oauthService.listInstagramAccounts).toHaveBeenCalledWith(
      'meta-access-token',
      'tenant-1',
    );
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].username).toBe('loja.acme');
  });

  it('should throw when tenant no longer exists', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ code: 'oauth-code', state: 'signed-state' }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
