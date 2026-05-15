import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import { InMemoryInventoryRepository } from './helpers/InMemoryInventoryRepository';
import { InMemoryEventBus } from './helpers/InMemoryEventBus';
import { InventoryInvalidSkuError } from '../domain/errors/InventoryInvalidSkuError';

describe('SyncInventoryItemUseCase (integration)', () => {
  let useCase: SyncInventoryItemUseCase;
  let repository: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    useCase = new SyncInventoryItemUseCase(repository, eventBus);
  });

  afterEach(() => {
    repository.clear();
    eventBus.reset();
  });

  const base = {
    tenantId: 'tenant-001',
    sku: 'PROD-001',
    name: 'Produto Teste',
    availableQuantity: 5,
    availabilityStatus: 'AVAILABLE' as const,
  };

  // ─── event publication ────────────────────────────────────────────────────

  it('INV-T-070a: sempre publica inventory.item.synced.v1', async () => {
    await useCase.execute(base);

    const synced = eventBus.getByEventName('inventory.item.synced.v1');
    expect(synced).toHaveLength(1);
    expect(synced[0].payload).toMatchObject({
      tenantId: 'tenant-001',
      sku: 'PROD-001',
      name: 'Produto Teste',
      availableQuantity: 5,
    });
  });

  it('INV-T-070b: item UNAVAILABLE publica inventory.item.unavailable.v1 além de synced', async () => {
    await useCase.execute({ ...base, availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    expect(eventBus.getByEventName('inventory.item.synced.v1')).toHaveLength(1);
    expect(eventBus.getByEventName('inventory.item.unavailable.v1')).toHaveLength(1);
  });

  it('INV-T-070c: item AVAILABLE não publica inventory.item.unavailable.v1', async () => {
    await useCase.execute(base);

    expect(eventBus.getByEventName('inventory.item.unavailable.v1')).toHaveLength(0);
  });

  it('INV-T-070d: mudança de preço publica inventory.price.changed.v1 com previousPrice e newPrice', async () => {
    await useCase.execute({ ...base, currentPrice: '50.00' });
    eventBus.reset();

    await useCase.execute({ ...base, currentPrice: '75.00' });

    const priceEvents = eventBus.getByEventName('inventory.price.changed.v1');
    expect(priceEvents).toHaveLength(1);
    expect(priceEvents[0].payload).toMatchObject({
      previousPrice: '50.00',
      newPrice: '75.00',
      sku: 'PROD-001',
    });
  });

  it('INV-T-070e: mesmo preço não publica inventory.price.changed.v1', async () => {
    await useCase.execute({ ...base, currentPrice: '50.00' });
    eventBus.reset();

    await useCase.execute({ ...base, currentPrice: '50.00' });

    expect(eventBus.getByEventName('inventory.price.changed.v1')).toHaveLength(0);
  });

  // ─── SKU validation ───────────────────────────────────────────────────────

  it('INV-T-070f: SKU vazio ou só espaços lança InventoryInvalidSkuError', async () => {
    await expect(useCase.execute({ ...base, sku: '' })).rejects.toThrow(InventoryInvalidSkuError);
    await expect(useCase.execute({ ...base, sku: '   ' })).rejects.toThrow(InventoryInvalidSkuError);
  });

  // ─── quantity clamping ────────────────────────────────────────────────────

  it('INV-T-070g: quantidade negativa é salva como 0 no repositório', async () => {
    const item = await useCase.execute({ ...base, availableQuantity: -10 });

    expect(item.availableQuantity).toBe(0);

    const saved = await repository.findItemBySku('tenant-001', 'PROD-001');
    expect(saved?.availableQuantity).toBe(0);
  });

  // ─── upsert idempotency ───────────────────────────────────────────────────

  it('INV-T-070h: segundo sync do mesmo SKU atualiza o registro existente (upsert)', async () => {
    const first = await useCase.execute({ ...base, availableQuantity: 5 });
    const second = await useCase.execute({ ...base, availableQuantity: 3, name: 'Nome Atualizado' });

    expect(second.id).toBe(first.id);
    expect(second.availableQuantity).toBe(3);
    expect(second.name).toBe('Nome Atualizado');

    const items = await repository.listItems({ tenantId: 'tenant-001' });
    expect(items).toHaveLength(1);
  });

  // ─── tenant isolation ─────────────────────────────────────────────────────

  it('INV-T-070i: mesmo SKU em tenants diferentes cria registros distintos', async () => {
    await useCase.execute({ ...base, tenantId: 'tenant-A' });
    await useCase.execute({ ...base, tenantId: 'tenant-B' });

    const itemA = await repository.findItemBySku('tenant-A', 'PROD-001');
    const itemB = await repository.findItemBySku('tenant-B', 'PROD-001');

    expect(itemA).not.toBeNull();
    expect(itemB).not.toBeNull();
    expect(itemA!.id).not.toBe(itemB!.id);
  });
});
