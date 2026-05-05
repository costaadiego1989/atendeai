import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('TenantBranch Entity', () => {
  function makeBranch(props: any = {}, id?: UniqueEntityID) {
    return TenantBranch.create(
      {
        tenantId: 'tenant-1',
        name: 'Loja Centro',
        cnpj: '12.345.678/0001-95',
        phone: '11999998888',
        email: 'centro@acme.com',
        whatsappNumber: '5511999998888',
        instagramAccountId: 'ig-123',
        whatsAppConfigOverride: null,
        address: null,
        operatingHours: null,
        isHeadquarters: false,
        active: true,
        ...props,
      },
      id,
    );
  }

  it('should create a valid tenant branch', () => {
    const branch = makeBranch();

    expect(branch.name).toBe('Loja Centro');
    expect(branch.cnpj).toBe('12345678000195');
    expect(branch.isHeadquarters).toBe(false);
    expect(branch.active).toBe(true);
  });

  it('should trim names and other strings', () => {
    const branch = makeBranch({
      name: '  Loja Barra  ',
      email: '  barra@acme.com  ',
    });

    expect(branch.name).toBe('Loja Barra');
    expect(branch.email).toBe('barra@acme.com');
  });

  it('should throw an error if name is too short', () => {
    expect(() => makeBranch({ name: 'A' })).toThrow('Branch name must have at least 2 characters');
  });

  it('should handle whatsAppConfigOverride', () => {
    const override = {
      provider: 'BUBBLEWHATS' as const,
      credentials: { id: 'branch-id', token: 'branch-token' },
      webhookSecret: '  secret  ',
    };
    const branch = makeBranch({ whatsAppConfigOverride: override });

    expect(branch.whatsAppConfigOverride?.provider).toBe('BUBBLEWHATS');
    expect(branch.whatsAppConfigOverride?.credentials.id).toBe('branch-id');
    expect(branch.whatsAppConfigOverride?.webhookSecret).toBe('secret');
  });

  it('should set whatsAppConfigOverride to null if credentials are empty', () => {
    const branch = makeBranch({
      whatsAppConfigOverride: {
        provider: 'BUBBLEWHATS',
        credentials: {},
      },
    });

    expect(branch.whatsAppConfigOverride).toBeNull();
  });

  it('should store address and operating hours', () => {
    const address = Address.create({
      zipcode: '01001-000',
      street: 'Praça da Sé',
      streetNumber: '1',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    });
    const hours = {
      monday: { open: '09:00', close: '18:00' },
    };

    const branch = makeBranch({ address, operatingHours: hours });

    expect(branch.address).toBe(address);
    expect(branch.operatingHours).toBe(hours);
  });
});
