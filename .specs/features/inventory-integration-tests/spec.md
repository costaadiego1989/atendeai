# Spec: Inventory Integration & E2E Tests

**ID:** INV-TEST  
**Status:** Approved  
**Scope:** Large — 7 providers, 3 use cases, event bus, DB persistence, tenant isolation  

---

## Context

The inventory module integrates 7 external platforms (Bling, Tiny, Nuvemshop, Shopify, WooCommerce, MercadoLivre, Shopee) via a `IInventoryProvider` interface. Each provider fetches stock via paginated HTTP calls and maps responses to `InventoryItemSnapshot`. Items are persisted via `SyncInventoryItemUseCase` which also publishes domain events to the event bus.

**Current gaps:**
- 6 of 7 providers have zero unit tests (only Bling is covered)
- No tests verify event payload correctness
- No tests for multi-page pagination
- No tests for two-step fetch (MercadoLivre, Shopee)
- No tests for Shopee HMAC-SHA256 signature generation
- No tests for tenant isolation in the DB
- No integration tests exercising the real event bus (in-process)
- No tests for the price-changed and item-unavailable event triggers

---

## Requirements

### R1 — Provider Unit Tests (all 7 providers)

**R1.1 — BlingProvider** (extend existing 4 tests)
- INV-T-061a: `fetchStock` yields correct `InventoryItemSnapshot` from real response shape (`{ data: [{ codigo, id, nome, estoque.saldoVirtual, preço }] }`)
- INV-T-061b: `fetchStock` stops after first page when `data.length < 100`
- INV-T-061c: `fetchStock` fetches page 2 when first page returns 100 items
- INV-T-061d: `fetchStock` maps `qty === 0` to `availabilityStatus: UNAVAILABLE`
- INV-T-061e: `fetchStock` maps `qty > 0` to `availabilityStatus: AVAILABLE`
- INV-T-061f: `testConnection` returns true on HTTP 200

**R1.2 — TinyProvider**
- INV-T-062a: `testConnection` throws when `token` missing
- INV-T-062b: `testConnection` throws on HTTP non-ok response
- INV-T-062c: `testConnection` returns true on HTTP 200
- INV-T-062d: `fetchStock` POST to `produtos.pesquisa.php` with correct body (token, formato, pagina)
- INV-T-062e: `fetchStock` paginates through `totalPages` from response
- INV-T-062f: `fetchStock` yields correct snapshot from response shape (`{ retorno: { produtos: [{ produto: { codigo, descricao, estoque, preco_unitario } }] } }`)
- INV-T-062g: `fetchStock` stops when empty page returned

**R1.3 — NuvemshopProvider**
- INV-T-063a: `testConnection` throws when `storeId` or `accessToken` missing
- INV-T-063b: `testConnection` uses `Authentication: bearer {token}` header (not `Authorization`)
- INV-T-063c: `testConnection` throws on non-ok response
- INV-T-063d: `fetchStock` calls `GET /v1/{storeId}/products?page={p}&per_page=50`
- INV-T-063e: `fetchStock` yields snapshot from response shape (`[{ variants: [{ sku, stock, price }], name }]`)
- INV-T-063f: `fetchStock` stops when empty array returned

**R1.4 — ShopifyProvider**
- INV-T-064a: `testConnection` throws when `shop` or `accessToken` missing
- INV-T-064b: `testConnection` uses `X-Shopify-Access-Token` header
- INV-T-064c: `fetchStock` calls Shopify Admin API v2024-01 products endpoint
- INV-T-064d: `fetchStock` uses cursor-based pagination (`page_info`)
- INV-T-064e: `fetchStock` yields snapshot from Shopify product+variants shape
- INV-T-064f: `fetchStock` maps `inventory_quantity` to `availableQuantity`

**R1.5 — WooCommerceProvider**
- INV-T-065a: `testConnection` throws when `siteUrl`, `consumerKey`, or `consumerSecret` missing
- INV-T-065b: `testConnection` uses Basic Auth (base64 `consumerKey:consumerSecret`)
- INV-T-065c: `fetchStock` calls `GET {siteUrl}/wp-json/wc/v3/products?per_page=100&page={p}`
- INV-T-065d: `fetchStock` yields snapshot from WooCommerce product shape (`{ sku, name, stock_quantity, regular_price }`)
- INV-T-065e: `fetchStock` stops when fewer than 100 products returned

**R1.6 — MercadoLivreProvider**
- INV-T-066a: `testConnection` throws when `userId` or `accessToken` missing
- INV-T-066b: `testConnection` calls `GET https://api.mercadolibre.com/users/{userId}` with Bearer
- INV-T-066c: `fetchStock` — step 1 fetches item IDs from search endpoint with offset+limit
- INV-T-066d: `fetchStock` — step 2 fetches details via `/items?ids={ids}&attributes=...`
- INV-T-066e: `fetchStock` yields snapshot from detail shape (`{ id, title, available_quantity, price, currency_id, seller_custom_field }`)
- INV-T-066f: `fetchStock` stops when search returns empty `results`
- INV-T-066g: `fetchStock` paginates by incrementing offset by 50

**R1.7 — ShopeeProvider**
- INV-T-067a: `testConnection` throws when `partnerId`, `partnerKey`, `accessToken`, or `shopId` missing
- INV-T-067b: `testConnection` generates valid HMAC-SHA256 signature (`partnerId + apiPath + timestamp + accessToken + shopId`)
- INV-T-067c: `fetchStock` — step 1 fetches item list with offset pagination
- INV-T-067d: `fetchStock` — step 2 fetches item details batch via `get_item_base_info`
- INV-T-067e: `fetchStock` yields snapshot from `{ item_sku, stock_info.normal_stock, price_info[0].current_price }`
- INV-T-067f: HMAC signature changes when any param changes (determinism)
- INV-T-067g: `fetchStock` stops when item list returns empty array

---

### R2 — SyncInventoryItemUseCase Integration Tests (real in-process event bus)

- INV-T-070a: sync new item → persists to DB with correct fields, publishes `inventory.item.synced.v1`
- INV-T-070b: sync item with `qty=0` → publishes both `inventory.item.synced.v1` AND `inventory.item.unavailable.v1`
- INV-T-070c: sync item with changed price → publishes `inventory.price.changed.v1` with `previousPrice` and `newPrice`
- INV-T-070d: sync item with unchanged price → does NOT publish `inventory.price.changed.v1`
- INV-T-070e: empty `sku` → throws `InventoryInvalidSkuError`, no DB write, no events
- INV-T-070f: `availableQuantity < 0` → stored as 0 (clamped)
- INV-T-070g: upsert idempotency — syncing same SKU twice updates, not duplicates

---

### R3 — CreateInventoryConnectionUseCase Integration Tests

- INV-T-071a: creates connection in DB, publishes `inventory.connection.created.v1` with correct payload
- INV-T-071b: duplicate provider+sourceType for same tenant → throws `InventoryDuplicateConnectionError`, no DB write
- INV-T-071c: connection record has correct `sourceType`, `providerName`, `tenantId`

---

### R4 — Provider HTTP Contract Tests (fetch mock matches real API shape)

For each provider, verify the response mapping is correct relative to the documented API shape:

- INV-T-080a: Bling response shape `{ data: [{ codigo, nome, estoque: { saldoVirtual }, preço, id }] }` → snapshot
- INV-T-080b: Tiny response shape `{ retorno: { produtos: [{ produto }] } }` → snapshot
- INV-T-080c: Nuvemshop response shape `[{ name, variants: [{ sku, stock, price }] }]` → snapshot
- INV-T-080d: Shopify response `{ products: [{ variants: [{ sku, inventory_quantity, price }], title }] }` → snapshot
- INV-T-080e: WooCommerce response `[{ sku, name, stock_quantity, regular_price }]` → snapshot
- INV-T-080f: MercadoLivre detail response `[{ body: { id, title, available_quantity, price, currency_id, seller_custom_field } }]` → snapshot
- INV-T-080g: Shopee detail response `{ response: { item_list: [{ item_sku, stock_info, price_info }] } }` → snapshot

---

### R5 — E2E Tests: Provider-Backed Connection Sync (fetch mocked, DB real)

- INV-T-090a: Create Bling connection → trigger sync → items persisted in DB per-tenant
- INV-T-090b: Create Tiny connection → trigger sync → items persisted in DB per-tenant
- INV-T-090c: Create Nuvemshop connection → trigger sync → items persisted in DB per-tenant
- INV-T-090d: Create MercadoLivre connection → trigger sync (two-step) → items persisted
- INV-T-090e: Sync marks `lastSyncedAt` on connection after completion
- INV-T-090f: Sync with provider HTTP error → throws, `lastSyncedAt` NOT updated
- INV-T-090g: Individual item sync failure does not abort full batch (resilience)

---

### R6 — E2E Tests: Tenant Isolation

- INV-T-091a: Items synced for tenant A not visible to tenant B via `GET /inventory/items`
- INV-T-091b: Connections created for tenant A not visible to tenant B via `GET /inventory/connections`
- INV-T-091c: Tenant B cannot trigger sync on tenant A's connection (403)

---

### R7 — E2E Tests: Event Bus Integration

- INV-T-092a: Sync item via HTTP → event bus receives `inventory.item.synced.v1` with full payload
- INV-T-092b: Sync UNAVAILABLE item → event bus receives both synced + unavailable events in order
- INV-T-092c: Create connection → event bus receives `inventory.connection.created.v1`

---

## Out of Scope

- Testing real live API credentials (all external HTTP mocked via `jest.fn()` on `global.fetch`)
- Worker cron scheduling (InventorySyncWorker interval logic)
- BullMQ queue async job processor (covered separately)
- Report CSV content (existing tests cover this)

---

## Test Classification

| Requirement | Type | File |
|---|---|---|
| R1 (Providers) | Unit | `__tests__/providers/` |
| R2 (SyncItem) | Integration | `__tests__/SyncInventoryItemUseCase.integration.spec.ts` |
| R3 (CreateConnection) | Integration | `__tests__/CreateInventoryConnectionUseCase.integration.spec.ts` |
| R4 (HTTP Contracts) | Unit | Within R1 provider files |
| R5 (Provider sync E2E) | E2E | `__tests__/inventory-provider-sync.e2e-spec.ts` |
| R6 (Tenant isolation) | E2E | `__tests__/inventory-tenant-isolation.e2e-spec.ts` |
| R7 (Event bus E2E) | E2E | `__tests__/inventory-event-bus.e2e-spec.ts` |
