# TEST-SPEC — `commerce`

## Objetivo

Sessões de compra, cupons, abandono e fulfillment — invariantes de estado e eventos para messaging/AI.

## IDs de cenários

Prefixo **`COM-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| COM-T-010 | Validação | Quantidades negativas, cupom formato inválido, session id UUID. |
| COM-T-020 | Sucesso | Add item / apply coupon / update fulfillment felizes. |
| COM-T-030 | Domínio | Session expirada, pedido já pago, cupom esgotado. |
| COM-T-040 | Integração | Handlers de pagamento não aplicam duas vezes o mesmo evento. |

## Inventário atual

- Unit sólido em `__tests__/*UseCase.spec.ts`, `commerce.e2e-spec.ts`.

## Lacunas (prioridade)

- **P0:** testes de corrida em atualização concorrente da mesma sessão (opcional pessimista).
- **P1:** relatórios CSV grandes — limites de memória/timeouts.

## Referências no código

- `commerce.module.ts`, `CommercePaymentEventHandler`, use cases listados nos specs.
