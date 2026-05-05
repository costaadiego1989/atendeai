# TEST-SPEC — `billing`

## Objetivo

Quotas, uso, mudança de plano e cobrança — invariantes financeiras e consistência com Stripe/webhooks internos.

## IDs de cenários

Prefixo **`BILL-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| BILL-T-010 | Validação | Limites numéricos de uso e IDs de plano inválidos. |
| BILL-T-020 | Sucesso | RecordUsage idempotente; CheckQuota edge nos limites exatos. |
| BILL-T-030 | Domínio | Cancelamento, mudança de plano com estado intermediário ilegal. |
| BILL-T-040 | Infra | Falha webhook ou processor Bull — reconciliação sem dupla faturação. |

## Inventário atual

- Cobertura unit/integration forte (~17 ficheiros), e2e billing e usage controller.

## Lacunas (prioridade)

- **P0:** cenários multi-tenant concorrentes para uso (`race` em quota).
- **P1:** export CSV helpers vs truncamento internacionalização.

## Referências no código

- `BillingModule`, processors em `__tests__/`, `CheckQuotaUseCase`.
