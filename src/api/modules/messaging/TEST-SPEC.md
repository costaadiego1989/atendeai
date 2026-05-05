# TEST-SPEC — `messaging`

## Objetivo

Entrega de mensagens multi-provedor, idempotência de webhooks, quotas de IA e consistência conversa↔contacto.

## IDs de cenários

Prefixo **`MSG-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| MSG-T-010 | Validação | Payload webhook fora do schema esperado por versão BubbleWhats. |
| MSG-T-020 | Sucesso | Envio/receive idempotente (mesmo `messageId`). |
| MSG-T-030 | Domínio | Conversa arquivada; opt-out LGPD; limite de anexos. |
| MSG-T-040 | Infra | Adapter indisponível — circuit breaker e DLQ quando existir. |
| MSG-T-050 | Segurança | Assinatura HMAC webhook inválida → 401. |

## Inventário atual

- Maior densidade de testes do monólito (~28 ficheiros): e2e, integration adapters, workers.

## Lacunas (prioridade)

- **P0:** matriz versionada de payloads reais (golden files) por release do parceiro.
- **P1:** testes de ordenação sob entrega fora de ordem.

## Referências no código

- `messaging.module.ts`, `BubbleWhatsAdapter`, `FollowUpWorker`.
