# Módulo: `inventory`

**Caminho:** `src/api/modules/inventory`  
**Última análise:** 2026-05-03  
**Papel:** stock e movimentos consumidos por catalog e commerce (e contexto na IA via `AIModule`).

## Valor ao utilizador / oportunidades

- Precisão de stock evita overselling — confiança e menos suporte manual.
- **Melhorias:** reservas temporais alinhadas a sessões de checkout; reconciliação com ERP.
- **Features:** multi-armazém, contagens periódicas com job.

## Acoplamento / manutenção

- Tipicamente “folha” de dependências no grafo Nest — bom; atenção a **imports inversos** (catalog chamando inventory) já mapeados no módulo catalog (`SyncInventoryItemUseCase`).

## Logs e traces distribuídos

- Ajustes de stock: correlacionar com `shoppingSessionId` ou `catalogItemId` em logs quando existir payload.

## KISS / DRY

- Uma política única para “incremento/decremento atómico”; evitar lógicas duplicadas em commerce handlers.

---

## Integrações externas (stock por conexão)

Contrato do provedor: `application/ports/IInventoryProvider.ts` — `testConnection(config)`, `fetchStock(config, lastSyncAt?)` como `AsyncGenerator` de lotes `InventoryItemSnapshot`.

Mapeamento `sourceType` → classe (`InventoryProviderFactory.ts`):

| `sourceType` | Implementação | Credenciais esperadas na `config` (resumo) |
|--------------|---------------|--------------------------------------------|
| `ERP_SYNC`, `BLING` | `BlingProvider` | `accessToken` (OAuth2 Bling v3) |
| `TINY` | `TinyProvider` | `token` (API Tiny) |
| `ECOMMERCE_SYNC`, `SHOPIFY` | `ShopifyProvider` | `shopUrl`, `accessToken` |
| `WOOCOMMERCE` | `WooCommerceProvider` | `storeUrl`, `consumerKey`, `consumerSecret` |
| `NUVEMSHOP` | `NuvemshopProvider` | (ver ficheiro do provider) |
| `MERCADOLIVRE` | `MercadoLivreProvider` | (ver ficheiro do provider) |
| `SHOPEE` | `ShopeeProvider` | (ver ficheiro do provider) |

**Alerta de produto:** o tipo `ERP_SYNC` está ligado ao **Bling**, não ao Tiny. Quem configurar `ERP_SYNC` com campos de outro ERP (ex. `baseUrl` sem `accessToken`) falhará na primeira sync ou na validação.

Endpoints HTTP ilustrativos já no código:

- **Bling:** `GET https://api.bling.com.br/Api/v3/usuarios/me`, produtos paginados `Api/v3/produtos`.
- **Tiny:** `api.tiny.com.br/api2/` (`info.php`, `produtos.pesquisa.php`).
- **Shopify:** Admin REST `.../admin/api/2024-01/products.json` (e paginação por header link).
- **WooCommerce:** `GET .../wp-json/wc/v3/products`, teste `system_status`.

Limitações observadas no código:

- **WooCommerce:** apenas produtos `type === 'simple'` **com** `sku`; variáveis/agrupados ficam de fora até haver modelo próprio.

---

## Modelo de sincronização

1. **`InventorySyncWorker`** (`application/workers/InventorySyncWorker.ts`): ao iniciar o módulo regista um **`setInterval` de 3 600 000 ms (1 h)** e em cada ciclo faz `prisma.inventoryConnection.findMany({ where: {} })` — todas as conexões da base, todos os tenants.
2. Por conexão chama **`SyncInventoryConnectionUseCase`**, que resolve o provider, consome `fetchStock(...)` e para cada snapshot corre **`SyncInventoryItemUseCase`** (upsert por SKU no tenant). Erros por item são **warn** e o ciclo continua; erro global na generator **propaga**.
3. **`lastSyncAt` na interface:** é passado `connection.lastSyncedAt` ao provider; **as implementações revistas ignoram o segundo argumento** — cada execução tende a ser **pull completo**, não incremental por data.
4. **REST:** não há rota HTTP para “sync desta conexão agora”; só worker horário + fluxos que invoquem o use case por código (`inventory.module.ts` exporta `SyncInventoryConnectionUseCase`).
5. **`InventoryConnectionCreatedIntegrationEvent`** (`queue`: `inventory.connection-created`): emitido na criação da conexão. **Não foi encontrado consumidor/handlers neste repositório** que disparassem sync imediata por esse evento — confiar apenas no polling horário ou integrações futuras.

Validação ao criar conexão (`CreateInventoryConnectionUseCase`): opcionalmente chama `testConnection`; falhas são **silenciadas** (`catch` vazio), pelo que conexões inválidas podem ser gravadas.

---

## Persistência

- **`inventoryItem.lastSyncedAt`:** atualizado em cada upsert (`PrismaInventoryRepository.syncItem`).
- **`inventoryConnection.lastSyncedAt`:** campo existe no modelo mapeado; após revisão **passa a ser atualizado ao fim de uma sync bem-sucedida** (`markConnectionSyncedAt` chamado desde `SyncInventoryConnectionUseCase`). Em caso de falha a meio do `fetchStock`, não deve ser atualizado.

---

## Testes e fiabilidade

- Existem testes e2e do módulo (`__tests__/inventory.e2e-spec.ts`) focados em items manuais, conexões simples e jobs de relatório — **sem suite dedicada aos providers HTTP** (mock de `fetch`).
- Para fiabilidade máxima endereçável incrementalmente: testes unitários por provider com `fetch` mockado; endurecer validação na criação; opcional `/connections/:id/sync`; consumidor Bull/out-of-band para `inventory.connection-created`; uso real de `lastSyncAt` onde as APIs permitirem delta sync.

## Especificação de testes (rastreável)

No código da API: [`src/api/modules/inventory/TEST-SPEC.md`](../../src/api/modules/inventory/TEST-SPEC.md) — IDs `INV-*` alinhados aos unit specs em `__tests__/`.
