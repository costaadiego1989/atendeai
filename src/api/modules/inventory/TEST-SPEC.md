# TEST-SPEC — `inventory`

## Objetivo

Stock fiável por tenant: conexões externas, sincronização agendada/manual futura, relatórios async e consistência SKU/preço — sem overselling downstream.

## IDs de cenários

Prefixo **`INV-T-NNN`**. *(Implementados nos unit specs onde indicado.)*

## Casos já cobertos por unit specs

| ID | Onde | Descrição |
|----|------|-----------|
| INV-SYNC-001 | `__tests__/SyncInventoryConnectionUseCase.spec.ts` | Conexão inexistente → `InventoryConnectionNotFoundError`. |
| INV-SYNC-002 | idem | Lotes + falha por SKU isolada + `markConnectionSyncedAt` ao fim. |
| INV-SYNC-003 | idem | Falha global em `fetchStock` → não marca conexão; erro propaga. |
| INV-SYNC-004 | idem | `lastSyncedAt` repassado ao provider. |
| INV-CONN-001 | `__tests__/CreateInventoryConnectionUseCase.spec.ts` | Duplicata → `InventoryDuplicateConnectionError`. |
| INV-CONN-002 | idem | Criação + evento `InventoryConnectionCreatedIntegrationEvent`. |
| INV-CONN-003 | idem | Falha em `testConnection` **não** bloqueia criação (comportamento atual documentado). |
| INV-CONN-004 | idem | Sem validação provider para `MANUAL_SNAPSHOT`. |

## Cenários prioritários ainda não automatizados

| ID | Tipo | Descrição |
|----|------|-----------|
| INV-T-050 | Validação | `CreateInventoryConnectionDTO` vs `InventoryProviderFactory`: `sourceType` no DTO não inclui `BLING`/`TINY`/`WOOCOMMERCE` enquanto factory sim — alinhar produto + testes e2e por fonte. |
| INV-T-060 | Infra | Providers com `fetch` mockado (Bling/Woo/Tiny): paginação, 401/429, corpo malformado. |
| INV-T-070 | API | POST `connections/:id/sync` (quando existir) + 403 entre tenants. |
| INV-T-080 | Worker | `InventorySyncWorker` intervalo e `findMany` global — teste com `useFakeTimers` + spy no use case. |
| INV-T-090 | Domínio | `SyncInventoryItemUseCase`: `InventoryInvalidSkuError` para sku vazio. |
| INV-T-100 | E2E | Job CSV: falha intermediária e estado `FAILED` + download 404 mensagem estável. |

## Inventário atual

- Unit: `SyncInventoryConnectionUseCase.spec.ts`, `CreateInventoryConnectionUseCase.spec.ts`
- E2E: `__tests__/inventory.e2e-spec.ts`
- Docs monorepo: `docs/api-modules-review/MODULE-inventory.md`

## Lacunas (prioridade)

- **P0:** alinhar DTO `sourceType` com integrações reais ou documentar deprecação.
- **P0:** consumidor `inventory.connection-created` para primeira sync ou endpoint manual.
- **P1:** não engolir erros em `tryValidateConnection` (ou tornar flag `strictValidation`).

## Referências no código

- `inventory.module.ts`, `InventorySyncWorker`, `InventoryController`, `application/providers/*Provider.ts`.
