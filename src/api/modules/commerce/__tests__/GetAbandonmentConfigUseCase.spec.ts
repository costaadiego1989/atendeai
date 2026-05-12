import { GetAbandonmentConfigUseCase } from '../application/use-cases/GetAbandonmentConfigUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';

describe('GetAbandonmentConfigUseCase', () => {
  let useCase: GetAbandonmentConfigUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';

  const mockConfig = {
    id: 'config-1',
    tenantId,
    active: true,
    message: 'Você esqueceu algo no carrinho!',
    useAiMessage: false,
    mode: 'QUEUE' as const,
    maxTouches: 3,
    intervalMinutes: 120,
    minimumIntervalMinutes: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    commerceRepo = {
      findAbandonmentConfigByTenantId: jest.fn(),
    } as any;

    useCase = new GetAbandonmentConfigUseCase(commerceRepo);
  });

  it('should return config for tenant when it exists', async () => {
    commerceRepo.findAbandonmentConfigByTenantId.mockResolvedValue(mockConfig as any);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual(mockConfig);
    expect(commerceRepo.findAbandonmentConfigByTenantId).toHaveBeenCalledWith(tenantId);
  });

  it('should return default config when none is set for tenant', async () => {
    commerceRepo.findAbandonmentConfigByTenantId.mockResolvedValue(null);

    const result = await useCase.execute(tenantId);

    expect(result.id).toBe('default');
    expect(result.tenantId).toBe(tenantId);
    expect(result.active).toBe(true);
    expect(result.useAiMessage).toBe(true);
    expect(result.mode).toBe('SINGLE');
    expect(result.maxTouches).toBe(1);
    expect(result.intervalMinutes).toBe(60);
    expect(result.minimumIntervalMinutes).toBe(30);
    expect(result.message).toBeNull();
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.findAbandonmentConfigByTenantId.mockResolvedValue(null);

    await useCase.execute(otherTenantId);

    expect(commerceRepo.findAbandonmentConfigByTenantId).toHaveBeenCalledWith(otherTenantId);
  });
});
