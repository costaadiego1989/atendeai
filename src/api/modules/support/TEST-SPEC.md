# TEST-SPEC — `support`

## Objetivo

Feedback/suporte com rastreio, sem vazamento de PII entre tenants e com visibilidade correta por papel.

## IDs de cenários

Prefixo **`SUP-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| SUP-T-010 | Validação | Texto vazio; anexo demasiado grande. |
| SUP-T-020 | Sucesso | Criação + listagem filtrada ao tenant. |
| SUP-T-030 | AuthZ | Utilizador de outro tenant não lê feedback alheio. |

## Inventário atual

- Apenas 2 ficheiros unit — **alto risco relativo ao tamanho do módulo operacional**.

## Lacunas (prioridade)

- **P0:** e2e do controller + testes de listagem paginada e filtros.
- **P1:** anexos/storage com URL pré-assinada e expiração.

## Referências no código

- `support.module.ts`, use cases `Create/List` em `application`.
