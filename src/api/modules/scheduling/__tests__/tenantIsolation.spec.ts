import { ListSchedulingCategoriesUseCase } from '../application/use-cases/ListSchedulingCategoriesUseCase';
import { ISchedulingStore } from '../domain/ports/ISchedulingStore';

describe('Scheduling — Tenant Isolation', () => {
  let schedulingStore: jest.Mocked<Pick<ISchedulingStore, 'listCategories' | 'listProfessionals' | 'listAvailability'>>;

  const TENANT_A = 'tenant-aaa';
  const TENANT_B = 'tenant-bbb';

  beforeEach(() => {
    schedulingStore = {
      listCategories: jest.fn(),
      listProfessionals: jest.fn(),
      listAvailability: jest.fn(),
    };
  });

  describe('ListSchedulingCategoriesUseCase', () => {
    let useCase: ListSchedulingCategoriesUseCase;

    beforeEach(() => {
      useCase = new ListSchedulingCategoriesUseCase(schedulingStore as any);
    });

    it('should pass tenantId to store when listing categories', async () => {
      schedulingStore.listCategories.mockResolvedValue([]);

      await useCase.execute(TENANT_A);

      expect(schedulingStore.listCategories).toHaveBeenCalledWith(TENANT_A, undefined);
    });

    it('should pass tenantId and branchId to store', async () => {
      schedulingStore.listCategories.mockResolvedValue([]);

      await useCase.execute(TENANT_A, 'branch-1');

      expect(schedulingStore.listCategories).toHaveBeenCalledWith(TENANT_A, 'branch-1');
    });

    it('should not leak categories across tenants', async () => {
      const tenantACategories = [
        { id: 'cat-1', tenantId: TENANT_A, name: 'Corte', unit: 'PER_SESSION' as const, active: true, createdAt: '2026-01-01' },
      ];
      const tenantBCategories = [
        { id: 'cat-2', tenantId: TENANT_B, name: 'Manicure', unit: 'PER_SESSION' as const, active: true, createdAt: '2026-01-01' },
      ];

      schedulingStore.listCategories
        .mockImplementation(async (tenantId) => {
          if (tenantId === TENANT_A) return tenantACategories;
          if (tenantId === TENANT_B) return tenantBCategories;
          return [];
        });

      const resultA = await useCase.execute(TENANT_A);
      const resultB = await useCase.execute(TENANT_B);

      expect(resultA).toEqual(tenantACategories);
      expect(resultB).toEqual(tenantBCategories);
      expect(resultA).not.toEqual(resultB);
    });

    it('should never call store without tenantId', async () => {
      schedulingStore.listCategories.mockResolvedValue([]);

      await useCase.execute(TENANT_A);

      const [calledTenantId] = schedulingStore.listCategories.mock.calls[0];
      expect(calledTenantId).toBe(TENANT_A);
      expect(calledTenantId).toBeTruthy();
    });
  });
});
