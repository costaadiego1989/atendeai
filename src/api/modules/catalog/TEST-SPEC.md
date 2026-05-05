# TEST-SPEC — `catalog`

## Objetivo

Catálogo e vínculos com inventário/commerce — upserts consistentes e proteção contra sku duplicado cross-branch quando aplicável.

## IDs de cenários

Prefixo **`CAT-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| CAT-T-010 | Validação | DTOs de item/categoria com whitelist (`ValidationPipe`). |
| CAT-T-020 | Sucesso | Upsert catálogo + reflexo esperado em queries list/detail. |
| CAT-T-030 | Domínio | SKU duplicado, categoria pai inválida, item arquivado. |
| CAT-T-040 | Integração | Chamadas a `SyncInventoryItemUseCase` — comando bem formado e erro propagado quando esperado. |

## Inventário atual

- Principalmente **`catalog.e2e-spec.ts`** (poucos unit dedicados ao domínio).

## Lacunas (prioridade)

- **P0:** unit specs dos use cases críticos cobertos só por e2e (tempo/isolação).
- **P1:** contratos de erro estáveis para frontend (códigos `DomainException`).

## Referências no código

- `catalog.module.ts`, use cases citados em `MODULE-catalog.md` (monorepo docs).
