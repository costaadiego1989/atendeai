import { NotFoundException } from '@nestjs/common';
import { ListCommerceOrdersUseCase } from '../application/use-cases/ListCommerceOrdersUseCase';
import { GetAbandonmentConfigUseCase } from '../application/use-cases/GetAbandonmentConfigUseCase';
import { GetCommerceOrderDetailsUseCase } from '../application/use-cases/GetCommerceOrderDetailsUseCase';

describe('Commerce — Tenant Isolation', () => {
  let commerceRepo: any;

  const TENANT_A = 'tenant-aaa';
  const TENANT_B = 'tenant-bbb';

  beforeEach(() => {
    commerceRepo = {
      listOrders: jest.fn(),
      findAbandonmentConfigByTenantId: jest.fn(),
      findOrderById: jest.fn(),
      findSessionById: jest.fn(),
      listSessionAbandonmentTouches: jest.fn(),
      upsertShippingPolicy: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
      saveAuditLog: jest.fn(),
    };
  });

  describe('ListCommerceOrdersUseCase', () => {
    let useCase: ListCommerceOrdersUseCase;

    beforeEach(() => {
      useCase = new ListCommerceOrdersUseCase(commerceRepo);
    });

    it('should pass tenantId to repository when listing orders', async () => {
      commerceRepo.listOrders.mockResolvedValue([]);

      await useCase.execute({ tenantId: TENANT_A });

      expect(commerceRepo.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });

    it('should not leak orders across tenants', async () => {
      commerceRepo.listOrders.mockResolvedValue([]);

      await useCase.execute({ tenantId: TENANT_B });

      expect(commerceRepo.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_B }),
      );
      expect(commerceRepo.listOrders).not.toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });

    it('should forward filters alongside tenantId', async () => {
      commerceRepo.listOrders.mockResolvedValue([]);
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-06-30');

      await useCase.execute({
        tenantId: TENANT_A,
        status: 'PAID',
        paymentStatus: 'CONFIRMED',
        dateFrom,
        dateTo,
      });

      expect(commerceRepo.listOrders).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        status: 'PAID',
        paymentStatus: 'CONFIRMED',
        dateFrom,
        dateTo,
      });
    });
  });

  describe('GetAbandonmentConfigUseCase', () => {
    let useCase: GetAbandonmentConfigUseCase;

    beforeEach(() => {
      useCase = new GetAbandonmentConfigUseCase(commerceRepo);
    });

    it('should scope abandonment config query by tenantId', async () => {
      commerceRepo.findAbandonmentConfigByTenantId.mockResolvedValue(null);

      await useCase.execute(TENANT_A);

      expect(commerceRepo.findAbandonmentConfigByTenantId).toHaveBeenCalledWith(TENANT_A);
    });

    it('should return tenant-specific default when no config exists', async () => {
      commerceRepo.findAbandonmentConfigByTenantId.mockResolvedValue(null);

      const result = await useCase.execute(TENANT_B);

      expect(result.tenantId).toBe(TENANT_B);
      expect(commerceRepo.findAbandonmentConfigByTenantId).toHaveBeenCalledWith(TENANT_B);
    });

    it('should never return config from another tenant', async () => {
      const configA = {
        id: 'config-a',
        tenantId: TENANT_A,
        active: true,
        message: 'Volte!',
        useAiMessage: false,
        mode: 'QUEUE' as const,
        maxTouches: 3,
        intervalMinutes: 120,
        minimumIntervalMinutes: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      commerceRepo.findAbandonmentConfigByTenantId.mockImplementation(
        async (tenantId: string) => {
          if (tenantId === TENANT_A) return configA;
          return null;
        },
      );

      const resultB = await useCase.execute(TENANT_B);

      expect(resultB.tenantId).toBe(TENANT_B);
      expect(resultB.id).toBe('default');
    });
  });

  describe('GetCommerceOrderDetailsUseCase', () => {
    let useCase: GetCommerceOrderDetailsUseCase;

    beforeEach(() => {
      useCase = new GetCommerceOrderDetailsUseCase(commerceRepo);
    });

    it('should scope order lookup by tenantId', async () => {
      commerceRepo.findOrderById.mockResolvedValue({
        id: 'order-1',
        tenantId: TENANT_A,
        sessionId: 'session-1',
        status: 'PAID',
      });
      commerceRepo.findSessionById.mockResolvedValue(null);
      commerceRepo.listSessionAbandonmentTouches.mockResolvedValue([]);

      await useCase.execute(TENANT_A, 'order-1');

      expect(commerceRepo.findOrderById).toHaveBeenCalledWith(TENANT_A, 'order-1');
    });

    it('should throw when order belongs to another tenant', async () => {
      commerceRepo.findOrderById.mockResolvedValue(null);

      await expect(
        useCase.execute(TENANT_B, 'order-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(commerceRepo.findOrderById).toHaveBeenCalledWith(TENANT_B, 'order-1');
    });
  });
});
