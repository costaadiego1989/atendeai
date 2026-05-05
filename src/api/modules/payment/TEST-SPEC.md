# TEST-SPEC — `payment`

## Objetivo

Intenção de pagamento, splits, webhooks PSP e reconciliação com sales/commerce sem duplicar cobrança.

## IDs de cenários

Prefixo **`PAY-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| PAY-T-010 | Validação | Valor mínimo/máximo, moeda suportada, metadata size. |
| PAY-T-020 | Sucesso | Criar intent + confirmar estado terminal coerente. |
| PAY-T-030 | Domínio | Charge expirada, reembolso parcial, split inválido. |
| PAY-T-040 | Infra | Webhook duplicado/out-of-order — idempotência na persistência. |
| PAY-T-050 | Segurança | Assinatura webhook; segredos não logados. |

## Inventário atual

- ~11 ficheiros `*.spec.ts` (ver `modules/payment/__tests__` e subpastas).

## Lacunas (prioridade)

- **P0:** e2e canário com PSP sandbox (se ainda não coberto pelo e2e global).
- **P1:** propriedades de valor monetário em `Decimal`/string vs number.

## Referências no código

- `payment.module.ts`, adapters em `infrastructure`, use cases em `application`.
