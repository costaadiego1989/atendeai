# TEST-SPEC — `agent-rules`

## Objetivo

Garantir regras de agente (draft/impacto/publicação), validação de payloads e isolamento por tenant sem regressões em comportamento da IA operacional.

## IDs de cenários

Prefixo **`AGENT-T-NNN`**: validação · sucesso · erro de domínio · erro infra · autorização.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| AGENT-T-010 | Validação | DTOs de criação/alteração com campos proibidos rejeitados (`ValidationPipe`). |
| AGENT-T-020 | Sucesso | Publicação ou ativação de regra aplicável apenas ao tenant corrente. |
| AGENT-T-030 | Domínio | Conflito de versão / regra duplicada / estado ilegal para transição. |
| AGENT-T-040 | AuthZ | Rotas apenas `OWNER`/`ADMIN`; tenant mismatch → 403/404 conforme política global. |
| AGENT-T-050 | Escala | Impact analysis não linear em número de conversas — limites e paginação. |

## Inventário atual

- Unit: `application/support/agentRuleDraft.spec.ts`
- E2E: `__tests__/agent-rules.e2e-spec.ts`, `agent-rules-impact.e2e-spec.ts`

## Lacunas (prioridade)

- **P0:** cobrir filtros de autorização nas rotas REST não cobertas pelo e2e atual (lista negativa por endpoint).
- **P1:** testes de propriedade/regressão para serialização do draft vs modelo persistido.

## Referências no código

- `presentation/controllers`, `application/use-cases`, `agent-rules.module.ts`.
