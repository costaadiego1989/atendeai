# TEST-SPEC — `social`

## Objetivo

Webhooks/redes e auto-reply — evitar loops, respeitar regras de plataforma e limites de frequência.

## IDs de cenários

Prefixo **`SOC-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| SOC-T-010 | Validação | Payload Meta/IG fora do schema. |
| SOC-T-020 | Sucesso | Regra matching e resposta gerada dentro de limite. |
| SOC-T-030 | Domínio | Cooldown anti-spam; regra desativada. |
| SOC-T-040 | Segurança | Verificação assinatura webhook. |

## Inventário atual

- 3 ficheiros unit (`auto-reply-engine`, rule, webhook).

## Lacunas (prioridade)

- **P0:** e2e com payload real minificado por versão da API Meta.
- **P1:** engine de regras composição AND/OR complexa.

## Referências no código

- `social.module.ts`, serviços em `application`.
