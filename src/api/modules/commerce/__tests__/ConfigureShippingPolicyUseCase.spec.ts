import { ConfigureShippingPolicyUseCase } from '../application/use-cases/ConfigureShippingPolicyUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { BadRequestException } from '@nestjs/common';

describe('ConfigureShippingPolicyUseCase', () => {
  let useCase: ConfigureShippingPolicyUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';

  const mockPolicy = {
    tenantId,
    mode: 'FIXED' as const,
    fixedAmount: 10,
    pricePerKm: null,
    minimumAmount: null,
    maxRadiusKm: null,
    servicedNeighborhoods: [],
    deliverySchedule: [],
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    commerceRepo = {
      upsertShippingPolicy: jest.fn(),
    } as any;

    useCase = new ConfigureShippingPolicyUseCase(commerceRepo);
  });

  it('should create a shipping policy with FIXED mode', async () => {
    commerceRepo.upsertShippingPolicy.mockResolvedValue(mockPolicy as any);

    const result = await useCase.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 10,
    });

    expect(result).toEqual(mockPolicy);
    expect(commerceRepo.upsertShippingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        mode: 'FIXED',
        fixedAmount: 10,
        active: true,
      }),
    );
  });

  it('should create a shipping policy with PER_KM mode', async () => {
    const perKmPolicy = { ...mockPolicy, mode: 'PER_KM' as const, fixedAmount: null, pricePerKm: 2.5 };
    commerceRepo.upsertShippingPolicy.mockResolvedValue(perKmPolicy as any);

    const result = await useCase.execute({
      tenantId,
      mode: 'PER_KM',
      pricePerKm: 2.5,
    });

    expect(result.mode).toBe('PER_KM');
    expect(commerceRepo.upsertShippingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        mode: 'PER_KM',
        pricePerKm: 2.5,
      }),
    );
  });

  it('should throw BadRequestException when FIXED mode has no fixedAmount', async () => {
    await expect(
      useCase.execute({ tenantId, mode: 'FIXED', fixedAmount: null }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when PER_KM mode has no pricePerKm', async () => {
    await expect(
      useCase.execute({ tenantId, mode: 'PER_KM', pricePerKm: null }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.upsertShippingPolicy.mockResolvedValue({
      ...mockPolicy,
      tenantId: otherTenantId,
    } as any);

    await useCase.execute({ tenantId: otherTenantId, mode: 'FIXED', fixedAmount: 5 });

    expect(commerceRepo.upsertShippingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });

  it('should normalize delivery schedule slots', async () => {
    commerceRepo.upsertShippingPolicy.mockResolvedValue(mockPolicy as any);

    await useCase.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 10,
      deliverySchedule: [
        { weekday: 'MONDAY', enabled: true, startTime: ' 08:00 ', endTime: ' 18:00 ' },
        { weekday: 'TUESDAY', enabled: false, startTime: '09:00', endTime: '17:00' },
      ],
    });

    expect(commerceRepo.upsertShippingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverySchedule: [
          { weekday: 'MONDAY', enabled: true, startTime: '08:00', endTime: '18:00' },
          { weekday: 'TUESDAY', enabled: false, startTime: null, endTime: null },
        ],
      }),
    );
  });
});
