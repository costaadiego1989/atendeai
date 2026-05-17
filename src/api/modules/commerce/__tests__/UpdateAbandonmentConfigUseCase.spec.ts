import { UpdateAbandonmentConfigUseCase } from '../application/use-cases/UpdateAbandonmentConfigUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';

describe('UpdateAbandonmentConfigUseCase', () => {
  let useCase: UpdateAbandonmentConfigUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';

  const mockUpdatedConfig = {
    id: 'config-1',
    tenantId,
    active: true,
    message: 'Volte e finalize seu pedido!',
    useAiMessage: false,
    mode: 'QUEUE' as const,
    maxTouches: 3,
    intervalMinutes: 90,
    minimumIntervalMinutes: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    commerceRepo = {
      upsertAbandonmentConfig: jest.fn(),
    } as any;

    useCase = new UpdateAbandonmentConfigUseCase(commerceRepo);
  });

  it('should update abandonment config', async () => {
    commerceRepo.upsertAbandonmentConfig.mockResolvedValue(
      mockUpdatedConfig as any,
    );

    const input = {
      active: true,
      message: 'Volte e finalize seu pedido!',
      useAiMessage: false,
      mode: 'QUEUE' as const,
      maxTouches: 3,
      intervalMinutes: 90,
    };

    const result = await useCase.execute(tenantId, input);

    expect(result).toEqual(mockUpdatedConfig);
    expect(commerceRepo.upsertAbandonmentConfig).toHaveBeenCalledWith({
      tenantId,
      ...input,
    });
  });

  it('should pass intervalMinutes to repository', async () => {
    commerceRepo.upsertAbandonmentConfig.mockResolvedValue(
      mockUpdatedConfig as any,
    );

    const input = {
      active: true,
      useAiMessage: true,
      mode: 'SINGLE' as const,
      maxTouches: 1,
      intervalMinutes: 60,
    };

    await useCase.execute(tenantId, input);

    expect(commerceRepo.upsertAbandonmentConfig).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMinutes: 60 }),
    );
  });

  it('should create config if it does not exist (upsert behavior)', async () => {
    const newConfig = { ...mockUpdatedConfig, id: 'new-config' };
    commerceRepo.upsertAbandonmentConfig.mockResolvedValue(newConfig as any);

    const input = {
      active: true,
      useAiMessage: true,
      mode: 'SINGLE' as const,
      maxTouches: 1,
      intervalMinutes: 60,
    };

    const result = await useCase.execute(tenantId, input);

    expect(result).toEqual(newConfig);
    expect(commerceRepo.upsertAbandonmentConfig).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.upsertAbandonmentConfig.mockResolvedValue({
      ...mockUpdatedConfig,
      tenantId: otherTenantId,
    } as any);

    const input = {
      active: false,
      useAiMessage: true,
      mode: 'SINGLE' as const,
      maxTouches: 2,
      intervalMinutes: 45,
    };

    await useCase.execute(otherTenantId, input);

    expect(commerceRepo.upsertAbandonmentConfig).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });
});
