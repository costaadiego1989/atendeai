import { TenantAIContextSnapshotService } from '../application/services/TenantAIContextSnapshotService';
import { ISchedulingContextProvider } from '../application/ports/ISchedulingContextProvider';
import { ICommerceContextProvider } from '../application/ports/ICommerceContextProvider';
import {
  ITenantAIContextSnapshotStore,
  TenantAIContextSnapshot,
} from '../application/ports/ITenantAIContextSnapshot';

describe('TenantAIContextSnapshot Integration', () => {
  let schedulingProvider: jest.Mocked<ISchedulingContextProvider>;
  let commerceProvider: jest.Mocked<ICommerceContextProvider>;
  let store: jest.Mocked<ITenantAIContextSnapshotStore>;
  let service: TenantAIContextSnapshotService;

  const tenantId = 'tenant-snap-1';

  beforeEach(() => {
    schedulingProvider = {
      findRelevantAvailability: jest.fn().mockResolvedValue(null),
      getSchedulingCategories: jest.fn().mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Corte de Cabelo',
          durationMinutes: 30,
          basePrice: 50,
          unit: 'PER_SESSION',
        },
        {
          id: 'cat-2',
          name: 'Escova',
          durationMinutes: 45,
          basePrice: 80,
          unit: 'PER_SESSION',
        },
      ]),
    };

    commerceProvider = {
      findConversationContext: jest.fn().mockResolvedValue(null),
      getCatalogItemCount: jest.fn().mockResolvedValue(12),
    };

    store = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new TenantAIContextSnapshotService(
      schedulingProvider,
      commerceProvider,
      store,
    );
  });

  it('should build and cache snapshot when no cached entry exists', async () => {
    store.get.mockResolvedValue(null);

    const snapshot = await service.getOrBuild(tenantId);

    expect(store.get).toHaveBeenCalledWith(tenantId);
    expect(schedulingProvider.getSchedulingCategories).toHaveBeenCalledWith(tenantId);
    expect(commerceProvider.getCatalogItemCount).toHaveBeenCalledWith(tenantId);
    expect(store.set).toHaveBeenCalledWith(tenantId, snapshot);
    expect(snapshot.tenantId).toBe(tenantId);
    expect(snapshot.schedulingCategories).toHaveLength(2);
    expect(snapshot.commerceCatalogItemCount).toBe(12);
  });

  it('should return cached snapshot on second call without re-fetching', async () => {
    const cached: TenantAIContextSnapshot = {
      tenantId,
      generatedAt: new Date(),
      schedulingCategories: [
        {
          id: 'cat-cached',
          name: 'Manicure',
          durationMinutes: 60,
          basePrice: 40,
          unit: 'PER_SESSION',
        },
      ],
      commerceCatalogItemCount: 5,
    };
    store.get.mockResolvedValue(cached);

    const result = await service.getOrBuild(tenantId);

    expect(result).toBe(cached);
    expect(schedulingProvider.getSchedulingCategories).not.toHaveBeenCalled();
    expect(commerceProvider.getCatalogItemCount).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('should invalidate snapshot by deleting from store', async () => {
    await service.invalidate(tenantId);

    expect(store.delete).toHaveBeenCalledWith(tenantId);
  });

  it('should return real scheduling categories count from provider', async () => {
    store.get.mockResolvedValue(null);

    const snapshot = await service.getOrBuild(tenantId);

    expect(snapshot.schedulingCategories).toEqual([
      {
        id: 'cat-1',
        name: 'Corte de Cabelo',
        durationMinutes: 30,
        basePrice: 50,
        unit: 'PER_SESSION',
      },
      {
        id: 'cat-2',
        name: 'Escova',
        durationMinutes: 45,
        basePrice: 80,
        unit: 'PER_SESSION',
      },
    ]);
  });

  it('should return real catalog item count from provider', async () => {
    store.get.mockResolvedValue(null);

    const snapshot = await service.getOrBuild(tenantId);

    expect(snapshot.commerceCatalogItemCount).toBe(12);
  });
});
