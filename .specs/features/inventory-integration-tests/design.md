# Design: Inventory Integration & E2E Tests

## Test Architecture

### Layer 1 — Unit (Provider)

**Pattern:** Instantiate provider directly, mock `global.fetch`, assert calls + snapshots.

```typescript
// Each provider spec
const provider = new BlingProvider();
const originalFetch = global.fetch;

afterEach(() => { global.fetch = originalFetch; });

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: [{ codigo: 'SKU-001', nome: 'Produto', estoque: { saldoVirtual: 10 }, preço: '25.90', id: 123 }] }),
}) as unknown as typeof fetch;
```

**No NestJS, no DB, no DI.** Pure function tests.

Files: `__tests__/providers/TinyProvider.spec.ts`, `NuvemshopProvider.spec.ts`, `ShopifyProvider.spec.ts`, `WooCommerceProvider.spec.ts`, `MercadoLivreProvider.spec.ts`, `ShopeeProvider.spec.ts`

---

### Layer 2 — Integration (Use Cases + Event Bus)

**Pattern:** Build minimal NestJS `TestingModule` with real use case, real in-memory event bus, **in-memory** repository mock.

```typescript
// No AppModule, no DB, no HTTP
const module = await Test.createTestingModule({
  providers: [
    SyncInventoryItemUseCase,
    { provide: INVENTORY_REPOSITORY, useValue: inMemoryRepo },
    { provide: EVENT_BUS, useValue: inMemoryEventBus },
  ],
}).compile();
```

**InMemoryEventBus:** captures published events in an array for assertion.

```typescript
class InMemoryEventBus implements IEventBus {
  readonly published: IntegrationEvent[] = [];
  async publish(event: IntegrationEvent) { this.published.push(event); }
}
```

**InMemoryInventoryRepository:** stores items in a `Map<string, InventoryItemRecord>` keyed by `${tenantId}:${sku}`.

Files: `__tests__/SyncInventoryItemUseCase.integration.spec.ts`, `__tests__/CreateInventoryConnectionUseCase.integration.spec.ts`

---

### Layer 3 — E2E (Full HTTP + DB + Real Event Bus)

**Pattern:** Same as existing `inventory.e2e-spec.ts` — `AppModule` with auth setup, HTTP supertest.

**Provider HTTP mocking strategy:** Mock `global.fetch` BEFORE the test that triggers sync, restore after.

```typescript
beforeEach(() => { realFetch = global.fetch; });
afterEach(() => { global.fetch = realFetch; });

it('syncs Bling items', async () => {
  global.fetch = jest.fn()
    // testConnection call
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // fetchStock page 1 (< 100 items → last page)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ codigo: 'BLING-001', nome: 'P1', estoque: { saldoVirtual: 5 }, preço: '10.00', id: 1 }] }),
    })
    as unknown as typeof fetch;

  // Create connection + trigger sync via HTTP
  // Assert DB
});
```

**Event bus spy for E2E:** Use `jest.spyOn` on the real event bus (retrieved from app):

```typescript
const eventBus = app.get<IEventBus>(EVENT_BUS);
const publishSpy = jest.spyOn(eventBus, 'publish');
// After sync:
expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
  eventName: 'inventory.item.synced.v1',
  payload: expect.objectContaining({ sku: 'BLING-001' }),
}));
```

Files:
- `__tests__/inventory-provider-sync.e2e-spec.ts`
- `__tests__/inventory-tenant-isolation.e2e-spec.ts`
- `__tests__/inventory-event-bus.e2e-spec.ts`

---

## Data Shapes Reference (from API docs + source code)

### Bling v3
```json
// GET /Api/v3/produtos?pagina=1&limite=100
{
  "data": [
    { "id": 123456, "codigo": "SKU-001", "nome": "Produto A", "preço": 25.90,
      "estoque": { "saldoVirtual": 10, "saldoFisico": 10 } }
  ]
}
// GET /Api/v3/usuarios/me → { "data": { "id": 1, "nome": "..." } }
```

### Tiny API2
```json
// POST api2/produtos.pesquisa.php
{
  "retorno": {
    "status": "OK",
    "numero_paginas": 3,
    "produtos": [
      { "produto": { "id": "9", "codigo": "SKU-T01", "descricao": "Produto Tiny", "unidade": "Un",
          "preco_unitario": "19.90", "estoque": "7.000" } }
    ]
  }
}
// POST api2/info.php → { "retorno": { "status": "OK" } }
```

### Nuvemshop v1
```json
// GET /v1/{storeId}/products?page=1&per_page=50
[
  { "id": 1, "name": { "pt": "Produto NS" },
    "variants": [{ "id": 11, "sku": "NS-SKU-001", "stock": 20, "price": "49.90" }] }
]
// GET /v1/{storeId}/store → { "id": 12345, "name": "Loja Teste" }
```

### Shopify Admin API 2024-01
```json
// GET /admin/api/2024-01/products.json?limit=250
{
  "products": [
    { "id": 1, "title": "Camiseta Azul",
      "variants": [{ "id": 11, "sku": "CAM-AZL-M", "inventory_quantity": 15, "price": "89.90" }] }
  ]
}
// Link header for cursor: <url?page_info=xyz>; rel="next"
// GET /admin/api/2024-01/shop.json → { "shop": { "id": 1, "name": "..." } }
```

### WooCommerce v3
```json
// GET /wp-json/wc/v3/products?per_page=100&page=1
[
  { "id": 1, "sku": "WOO-001", "name": "Produto WC", "stock_quantity": 8, "regular_price": "35.00" }
]
```

### MercadoLivre
```json
// GET /users/{userId}/items/search?offset=0&limit=50
{ "results": ["MLB1234567890"], "paging": { "total": 1, "offset": 0, "limit": 50 } }
// GET /items?ids=MLB1234567890&attributes=...
[{ "code": 200, "body": { "id": "MLB1234567890", "title": "Produto ML",
    "available_quantity": 3, "price": 99.90, "currency_id": "BRL",
    "seller_custom_field": "ML-SKU-001" } }]
```

### Shopee Partner API v2
```json
// GET /api/v2/product/get_item_list?...&item_status=NORMAL
{ "response": { "item": [{ "item_id": 123456 }], "has_next_page": false, "next_offset": 50 } }
// GET /api/v2/product/get_item_base_info?item_id_list=123456
{ "response": { "item_list": [
    { "item_id": 123456, "item_sku": "SHOPEE-001",
      "stock_info": { "normal_stock": 12 },
      "price_info": [{ "current_price": 79.90 }] }
] } }
// Signature: HMAC-SHA256("{partnerId}{apiPath}{timestamp}{accessToken}{shopId}", partnerKey)
```

---

## Test Helpers (shared)

```typescript
// test/helpers/inventory-helpers.ts
export function makeBlingPage(items: Partial<BlingItem>[] = [], fill = false) {
  const base = fill ? Array(100).fill(mockBlingItem()) : items.map(mergeBling);
  return { ok: true, json: async () => ({ data: base }) };
}

export function makeTinyPage(items: any[], totalPages = 1) {
  return { ok: true, json: async () => ({
    retorno: { status: 'OK', numero_paginas: totalPages,
      produtos: items.map(i => ({ produto: i })) }
  }) };
}
// etc. for each provider
```

---

## Conventions

- Mock `global.fetch` — never use `nock` or `msw` (not in project stack)
- Restore `global.fetch` in `afterEach` always
- E2E: unique email + CNPJ per `describe` using `Date.now()`
- E2E cleanup: `afterAll` deletes inventory items and connections by `tenantId`
- Integration: use `InMemoryInventoryRepository` and `InMemoryEventBus` — never `PrismaService`
- Provider specs: no `describe` nesting beyond 2 levels
- All IDs use `INV-T-0XX` traceable to spec
