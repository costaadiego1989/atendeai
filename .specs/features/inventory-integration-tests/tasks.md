# Tasks: Inventory Integration & E2E Tests

**Feature:** INV-TEST  
**Total tasks:** 9  
**Execution:** Sequential (T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9)

---

## T1 — Shared test helpers

**What:** Create `src/api/modules/inventory/__tests__/helpers/` with mock factory functions for each provider response shape and shared `InMemoryEventBus` + `InMemoryInventoryRepository`.

**Files:**
- `src/api/modules/inventory/__tests__/helpers/inventory-mock-factories.ts`
- `src/api/modules/inventory/__tests__/helpers/InMemoryInventoryRepository.ts`
- `src/api/modules/inventory/__tests__/helpers/InMemoryEventBus.ts`

**InMemoryInventoryRepository** must implement `IInventoryRepository`:
- `syncItem`: upsert into `Map<tenantId:sku, InventoryItemRecord>`, auto-generate UUID id
- `listItems`: filter map by tenantId + query/availableOnly
- `findItemBySku`: lookup from map
- `createConnection`: store in `Map<id, InventoryConnectionRecord>`
- `listConnections`: filter by tenantId
- `findConnectionByProvider`: find by tenantId+sourceType+providerName
- `markConnectionSyncedAt`: update lastSyncedAt in map

**InMemoryEventBus** implements `IEventBus`:
- `published: IntegrationEvent[]` array
- `publish(event)`: push to array
- `reset()`: clear array

**Mock factories** (return `fetch`-compatible `{ ok, json }` objects):
- `makeBlingFetchOk(items?, fullPage?)` — default 1 item, `fullPage=true` fills 100 items
- `makeBlingAuthOk()` — testConnection response
- `makeTinyAuthOk()`, `makeTinyPage(items, totalPages?)`
- `makeNuvemshopAuthOk()`, `makeNuvemshopPage(variants?)`
- `makeShopifyAuthOk()`, `makeShopifyPage(variants?, nextCursor?)`
- `makeWooCommerceAuthOk()`, `makeWooCommercePage(products?, fullPage?)`
- `makeMercadoLivreAuthOk()`, `makeMercadoLivreSearch(ids?)`, `makeMercadoLivreDetails(items?)`
- `makeShopeeAuthOk()`, `makeShopeeItemList(itemIds?, hasNextPage?)`, `makeShopeeItemDetail(items?)`

**Done when:** Files compile without TS errors, exported types match interfaces.

**Gate:** `npx tsc --noEmit --project tsconfig.json`

---

## T2 — BlingProvider extended unit tests

**What:** Extend `BlingProvider.spec.ts` with R1.1 tests (INV-T-061a through INV-T-061f).

**Files:**
- `src/api/modules/inventory/__tests__/BlingProvider.spec.ts` (extend)

**Tests to add:**
- `INV-T-061a`: fetchStock yields `InventoryItemSnapshot` with correct fields from real response shape
- `INV-T-061b`: fetchStock stops after page with <100 items (calls fetch once)
- `INV-T-061c`: fetchStock fetches page 2 when first page has exactly 100 items
- `INV-T-061d`: qty=0 → `availabilityStatus: 'UNAVAILABLE'`
- `INV-T-061e`: qty>0 → `availabilityStatus: 'AVAILABLE'`
- `INV-T-061f`: testConnection returns true on 200

**Done when:** All existing + new Bling tests pass.

**Gate:** `npx jest BlingProvider --no-coverage`

---

## T3 — TinyProvider unit tests

**What:** Create `__tests__/providers/TinyProvider.spec.ts` with R1.2 tests (INV-T-062a through INV-T-062g).

**Files:**
- `src/api/modules/inventory/__tests__/providers/TinyProvider.spec.ts` (new)

**Key assertions:**
- testConnection POST body: `token={token}&formato=JSON`
- fetchStock POST body: `token={token}&formato=JSON&pagina={p}&situacao=A&pesquisa=`
- Response shape: `retorno.numero_paginas` for totalPages, `retorno.produtos[].produto` for items
- Snapshot mapping: `produto.codigo` → sku, `produto.descricao` → name, `Number(produto.estoque)` → qty

**Done when:** 7 tests pass.

**Gate:** `npx jest TinyProvider --no-coverage`

---

## T4 — NuvemshopProvider, ShopifyProvider, WooCommerceProvider unit tests

**What:** Create provider specs for R1.3, R1.4, R1.5.

**Files:**
- `src/api/modules/inventory/__tests__/providers/NuvemshopProvider.spec.ts` (new)
- `src/api/modules/inventory/__tests__/providers/ShopifyProvider.spec.ts` (new)
- `src/api/modules/inventory/__tests__/providers/WooCommerceProvider.spec.ts` (new)

**Nuvemshop key assertions:**
- Header is `Authentication: bearer {token}` (not `Authorization`)
- `fetchStock` reads `variants[].sku` for sku, `variants[].stock` for qty, `variants[].price` for price
- Uses `name` object — provider may return `{ pt: 'Nome' }` or string; handle both

**Shopify key assertions:**
- Header is `X-Shopify-Access-Token: {token}`
- Pagination via `Link` header `page_info` cursor — test both has-next and no-next
- Maps `variants[].inventory_quantity` → availableQuantity

**WooCommerce key assertions:**
- Auth: `Authorization: Basic {base64(key:secret)}`
- Stops when `products.length < 100`
- Maps `stock_quantity` → availableQuantity, `regular_price` → currentPrice

**Done when:** All tests pass for all 3 providers.

**Gate:** `npx jest "NuvemshopProvider|ShopifyProvider|WooCommerceProvider" --no-coverage`

---

## T5 — MercadoLivreProvider and ShopeeProvider unit tests

**What:** Create provider specs for R1.6 and R1.7 (most complex — two-step fetch and signature).

**Files:**
- `src/api/modules/inventory/__tests__/providers/MercadoLivreProvider.spec.ts` (new)
- `src/api/modules/inventory/__tests__/providers/ShopeeProvider.spec.ts` (new)

**MercadoLivre key assertions:**
- Two fetch calls per page: search then detail
- `fetch` called with `/items?ids=MLB1234567890&attributes=...` after search
- Snapshot: `seller_custom_field` → sku (or `id` if null), `title` → name, `available_quantity` → qty
- Stops when search `results` is empty

**Shopee key assertions:**
- Signature = `HMAC-SHA256("{partnerId}{apiPath}{timestamp}{accessToken}{shopId}", partnerKey)`
- Test signature determinism: same inputs → same signature
- Two fetch calls per iteration: item list then item base info
- Snapshot: `item_sku` → sku, `stock_info.normal_stock` → qty, `price_info[0].current_price` → price
- Stops when item list returns empty items

**Done when:** 7+7 tests pass.

**Gate:** `npx jest "MercadoLivreProvider|ShopeeProvider" --no-coverage`

---

## T6 — SyncInventoryItemUseCase integration tests

**What:** Create `__tests__/SyncInventoryItemUseCase.integration.spec.ts` with R2 tests using `InMemoryInventoryRepository` and `InMemoryEventBus`.

**Files:**
- `src/api/modules/inventory/__tests__/SyncInventoryItemUseCase.integration.spec.ts` (new)

**Setup:**
```typescript
const repo = new InMemoryInventoryRepository();
const bus = new InMemoryEventBus();
const useCase = new SyncInventoryItemUseCase(repo, bus);
beforeEach(() => { repo.clear(); bus.reset(); });
```

**Tests (INV-T-070a through INV-T-070g):**
- 070a: new item → `repo.findItemBySku` returns item, `bus.published[0].eventName === 'inventory.item.synced.v1'`
- 070b: qty=0 + UNAVAILABLE → bus has 2 events: synced + unavailable
- 070c: sync twice with different price → bus has `inventory.price.changed.v1` with correct prev/new
- 070d: sync twice with same price → no price-changed event
- 070e: empty sku → throws `InventoryInvalidSkuError`, bus has 0 events
- 070f: negative qty → item stored with `availableQuantity: 0`
- 070g: sync same SKU twice → `repo.listItems()` returns 1 item (upsert, not duplicate)

**Done when:** 7 tests pass.

**Gate:** `npx jest "SyncInventoryItemUseCase.integration" --no-coverage`

---

## T7 — CreateInventoryConnectionUseCase integration tests

**What:** Create `__tests__/CreateInventoryConnectionUseCase.integration.spec.ts` with R3 tests.

**Files:**
- `src/api/modules/inventory/__tests__/CreateInventoryConnectionUseCase.integration.spec.ts` (new)

**Setup:** Real `CreateInventoryConnectionUseCase`, `InMemoryInventoryRepository`, `InMemoryEventBus`. Mock provider factory that returns a provider where `testConnection` always resolves true.

**Tests (INV-T-071a through INV-T-071c):**
- 071a: creates connection → `repo.listConnections(tenantId)` has 1 record, `bus.published[0].eventName === 'inventory.connection.created.v1'`, payload has `connectionId`, `tenantId`, `sourceType`, `providerName`
- 071b: create same tenantId+sourceType+providerName twice → second call throws `InventoryDuplicateConnectionError`, repo still has 1 connection
- 071c: connection record fields match input exactly

**Done when:** 3 tests pass.

**Gate:** `npx jest "CreateInventoryConnectionUseCase.integration" --no-coverage`

---

## T8 — E2E: Provider-backed sync + tenant isolation

**What:** Create 2 E2E specs using `AppModule` and real DB. External HTTP mocked via `global.fetch`.

**Files:**
- `src/api/modules/inventory/__tests__/inventory-provider-sync.e2e-spec.ts` (new)
- `src/api/modules/inventory/__tests__/inventory-tenant-isolation.e2e-spec.ts` (new)

**inventory-provider-sync.e2e-spec.ts:**
- Setup: same pattern as `inventory.e2e-spec.ts` (create tenant, login, get authCookie)
- Mock `global.fetch` to return provider-shaped responses before triggering HTTP sync
- INV-T-090a: Create Bling connection → POST /connections/sync → GET /items → items in DB
- INV-T-090b: Create Tiny connection → same flow
- INV-T-090c: Create Nuvemshop connection → same flow
- INV-T-090d: Create MercadoLivre connection → two-step fetch mock → items in DB
- INV-T-090e: After successful sync → GET /connections → `lastSyncedAt` is not null
- INV-T-090f: Sync with HTTP 500 from provider → HTTP 500 from API, lastSyncedAt unchanged
- INV-T-090g: One item in batch causes invalid sku → other items still persisted

**inventory-tenant-isolation.e2e-spec.ts:**
- Setup: 2 tenants (tenantA + tenantB), 2 authCookies
- INV-T-091a: Sync item for tenantA → tenantB GET /items returns empty
- INV-T-091b: Create connection for tenantA → tenantB GET /connections returns empty
- INV-T-091c: tenantB POST /{tenantAId}/inventory/connections/{connId}/sync → 403

**Cleanup (afterAll):**
```sql
DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenantId}::uuid;
DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${tenantId}::uuid;
```

**Done when:** All E2E tests pass against real local DB.

**Gate:** `npx jest "inventory-provider-sync|inventory-tenant-isolation" --config test/jest-e2e.json --no-coverage`

---

## T9 — E2E: Event bus integration

**What:** Create `__tests__/inventory-event-bus.e2e-spec.ts` with R7 tests using `jest.spyOn` on real event bus.

**Files:**
- `src/api/modules/inventory/__tests__/inventory-event-bus.e2e-spec.ts` (new)

**Pattern:**
```typescript
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
const eventBus = app.get<IEventBus>(EVENT_BUS);
const spy = jest.spyOn(eventBus, 'publish');
beforeEach(() => spy.mockClear());
```

**Tests (INV-T-092a through INV-T-092c):**
- 092a: POST /items/sync (AVAILABLE item) → spy called with `inventory.item.synced.v1`, payload has `sku`, `tenantId`, `availabilityStatus`
- 092b: POST /items/sync (qty=0, UNAVAILABLE) → spy called twice: `inventory.item.synced.v1` then `inventory.item.unavailable.v1`
- 092c: POST /connections (with provider testConnection mocked) → spy called with `inventory.connection.created.v1`

**Done when:** 3 E2E event bus tests pass.

**Gate:** `npx jest "inventory-event-bus" --config test/jest-e2e.json --no-coverage`

---

## Traceability Matrix

| Test ID | Requirement | Task | File |
|---|---|---|---|
| INV-T-061a-f | R1.1 | T2 | BlingProvider.spec.ts |
| INV-T-062a-g | R1.2 | T3 | TinyProvider.spec.ts |
| INV-T-063a-f | R1.3 | T4 | NuvemshopProvider.spec.ts |
| INV-T-064a-f | R1.4 | T4 | ShopifyProvider.spec.ts |
| INV-T-065a-e | R1.5 | T4 | WooCommerceProvider.spec.ts |
| INV-T-066a-g | R1.6 | T5 | MercadoLivreProvider.spec.ts |
| INV-T-067a-g | R1.7 | T5 | ShopeeProvider.spec.ts |
| INV-T-080a-g | R4 | T2-T5 | Within provider specs |
| INV-T-070a-g | R2 | T6 | SyncInventoryItemUseCase.integration.spec.ts |
| INV-T-071a-c | R3 | T7 | CreateInventoryConnectionUseCase.integration.spec.ts |
| INV-T-090a-g | R5 | T8 | inventory-provider-sync.e2e-spec.ts |
| INV-T-091a-c | R6 | T8 | inventory-tenant-isolation.e2e-spec.ts |
| INV-T-092a-c | R7 | T9 | inventory-event-bus.e2e-spec.ts |
