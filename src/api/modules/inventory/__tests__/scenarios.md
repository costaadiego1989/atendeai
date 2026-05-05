# Análise e Bateria de Testes — Módulo Inventory (Estoque)

Análise da arquitetura do módulo `inventory` e sua condição atual de cobertura. Assim como o módulo *Catalog*, o *Inventory* não utiliza Entidades puras ricas de Domínio (DDD puro com `AggregateRoots`), mas sim o padrão **Transaction Script** com `UseCases` agindo sobre Records persistidos no Prisma e emitindo eventos ao barramento. 

Ele é uma fonte primária de verdade para produtos do *Commerce* saberem se podem ser comprados (controle por SKU, Qtd e Status).

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Data Structures/Ports)** | `InventoryItemRecord`, `InventoryConnectionRecord`, `IInventoryRepository`. |
| **Domain Errors** | `InventoryConnectionNotFoundError`, `InventoryDuplicateConnectionError`, `InventoryInvalidSkuError`, `InventoryItemNotFoundError`. |
| **Integration Events** | `InventoryItemSynced`, `InventoryItemUnavailable`, `InventoryPriceChanged`. |
| **Use Cases (5)** | `CreateInventoryConnection`, `ListInventoryConnections`, `ListInventoryItems`, `SyncInventoryConnection`, `SyncInventoryItem`. |
| **Background Workers** | `InventorySyncWorker` (Processa sincronizações em massa num setInterval de 1h). |
| **Controllers** | `InventoryController` (REST API). |
| **Persistence** | `PrismaInventoryRepository`. |

---

## Cobertura Atual (1 Arquivo de Teste Existente)

Atualmente **NÃO EXISTE NENHUM TESTE UNITÁRIO** isolado. 

### 🟡 Teste Rest E2E (`inventory.e2e-spec.ts`)
| Cenário | Status |
|---|---|
| 1. Sincroniza Itens, atualiza estoque pra LOW, pesquisa por Sku / Name e Availability. | 🟡 Bom happy path, porém não testa emissão real dos eventos de ruptura de estoque (Unavailable) para outros módulos lerem. |
| 2. Painel conectivo manual vs Tiny ERP. | 🟡 Verifica apenas CRUD simples rest. |

---

## Lacunas Identificadas (Gaps Críticos)

### 🔴 Uso Intenso do Event Bus não é Validado
UseCases como `SyncInventoryItemUseCase` determinam se o sistema deve emitir um `InventoryItemUnavailableIntegrationEvent` quando `availabilityStatus` passa para `UNAVAILABLE` ou `InventoryPriceChangedIntegrationEvent` se o preço mudar. Se isso bugar, lojas continuarão marcando produtos inexistentes no catálago ou preços errados. Não há testes mockando eventBus para atestar que os payloads saem corretamente.

### 🔴 Lógica de Estoque Negativo Mascarada
O Use Case possui `Math.max(0, command.availableQuantity)`, ou seja, blinda silenciosamente quantidades negativas. Isso *precisa* ser coberto em testes, demonstrando a intenção do autor formalmente (uma atualização via ERP enviando -5 de estoque resultará em 0 e não na quebra do sistema). E sem teste, qualquer dev distraído que remova o `Math.max` destrói o software silenciosamente.

### 🔴 Background Worker (Ghost)
O `InventorySyncWorker.ts` carrega conexões do painel global `prisma.inventoryConnection.findMany({ where: {} });` sem tenant bound e aciona o Sincronizador. Um retry ou erro crasso dentro desse loop não causa exceptions que o framework veja (ele loga apenas). Esse background worker não tem validação de resiliência (Ex: Se do tenant A o worker falhar, ele segue para o tenant B?).

### 🟡 Prisma Repository
Como não há Entidades, o repositório formata as chamadas usando queries compostas (ex: `listItems` procura `OR: filters.query ? name contains, description contains`). Sem testes de Integração, a menor mudança corrompe a consulta.

---

## Proposta de Bateria de Testes

### FASE 1 — Domain Errors (Priority: 🟢 LOW)
- `[NEW]` Validar os 4 Custom Errors estendendo `DomainException`.

### FASE 2 — Core Use Cases & Integration Events (Priority: 🔴 CRITICAL)

##### `SyncInventoryItemUseCase.spec.ts` (NEW)
- Validar exception customizada se `sku` for string em branco.
- Garantir `Math.max(0, quantity)` passando -50 e assegurando que passa 0 para o `inventoryRepository.syncItem`.
- Garantir a trigger do `InventoryItemSyncedIntegrationEvent` padrão ao final com payload 100% aderente se houver alteração de sucesso.
- Garantir que um item que se tornou Vazio mande O Evento Opcional Extra `InventoryItemUnavailableIntegrationEvent`.
- Garantir que se a pesquisa na base trouxer um item e o campo `currentPrice` for diferente na requisição nova, o sistema mande o `InventoryPriceChangedIntegrationEvent`.
- Garantir que *não* mande evento de mudança de preço se já era igual.

##### SyncInventoryConnection e Create Connection (NEW)
- Testar lançamento de duplicate error se o config já existir.
- (Sync de conexão em si parece delegar logica específica a provedores ou estar draftada).

### FASE 3 — Background Services / Workers (Priority: 🔴 HIGH)

##### `InventorySyncWorker.spec.ts` (NEW)
- Mockar a lista do repositório para devolver 3 tenants ativos.
- Forçar que a rotina `syncInventoryConnectionUseCase.execute` falhe (`throw`) no primeiro tenant.
- **Asserção Vital:** Garantir que o laço principal continue com `catch` ignorando local e o Tenant B e C processem perfeitamente (resiliência).

### FASE 4 — Queries Internas & Integração Prisma (Priority: 🟡 MEDIUM)

##### `ListInventoryItemsUseCase.spec.ts` e `ListInventoryConnectionsUseCase.spec.ts` (NEW)
- Apenas mocka o Repositório e checa os repasses de variáveis de paginação.

##### `PrismaInventoryRepository.integration.spec.ts` (NEW)
- Cria item e testa Update e SyncItem garantindo que `upsert` na chave composta ocorra corretamente.
- Injeta uma Listagem com query e `availableOnly=true` atestando que os filtros funcionam sem quebrar no ORM.

---

## Quadro Comparativo Sugerido

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Errors / Domain** | 0 | ~4 | 4 |
| **Unit — Core Use Cases** | 0 | ~18 | 18 |
| **Unit — Background Workers** | 0 | ~4 | 4 |
| **Integration (Prisma)** | 0 | ~9 | 9 |
| **E2E (Controllers)** | 1 (File) | 0 | 1 |
| **TOTAL** | **~1** | **~35** | **~36** |

---

## User Review Required

> [!WARNING]
> A Sincronização e Worker de Estoque Global (`InventorySyncWorker`) puxa de uma forma generalista (`findMany({})`) todos os registros de sync (TinyERP, Bling, CSV). Se seu software escalar para 1.000 lojas operando simultaneamente, rodar o `.map()` dentro de um Node.js sem filas (BullMQ ou RabbitMQ) irá estressar o Pool de banco e pode matar a thread de event-loop. Como o escopo original não contempla BullMQ para o Worker do Inventário (ao contrário do Provisioning de Billing que usa `BillingProvisioningProcessor`: BullMQ), a minha recomendação de teste focará em testar que a falha de 1 laço *não destrói* o loop atual. Concorda com essa postura defensiva sem mudar a arquitetura toda hoje?

## Verification Plan

### Automated Tests
Rodaremos a bateria para garantir cobertura interna e assertividade da emissão de Eventos (EventBus Mocker):
```bash
npx jest --testPathPattern="src/modules/inventory" --verbose
```
