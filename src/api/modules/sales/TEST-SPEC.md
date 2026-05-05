# TEST-SPEC — `sales`

## Objetivo

Cupons, métricas, payment links e relatórios — números financeiros auditáveis e sem double-redeem.

## IDs de cenários

Prefixo **`SAL-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| SAL-T-010 | Validação | Código cupom formato; limites de uso. |
| SAL-T-020 | Sucesso | Redeem feliz + tracking métrica. |
| SAL-T-030 | Domínio | Cupom expirado, esgotado, incompatível com plano. |
| SAL-T-040 | Infra | Webhook/evento billing refletido uma única vez em métricas. |

## Inventário atual

- Unit + integration + e2e sales e coupon.

## Lacunas (prioridade)

- **P1:** relatórios CSV com separador decimal em locale BR.

## Referências no código

- `sales.module.ts`, `RedeemCouponUseCase`, CSV builders em `__tests__/`.
