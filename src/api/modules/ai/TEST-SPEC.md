# TEST-SPEC — `ai`

## Objetivo

Segurança e correção da pipeline de IA (handlers, quotas, media, prompts, commerce context), incluindo falhas de adapters externos e políticas de handoff.

## IDs de cenários

Prefixo **`AI-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| AI-T-010 | Validação | Entrada de mensagem/sessão inválida ou truncamentos extremos. |
| AI-T-020 | Sucesso | Fluxo feliz ProcessAIResponse / prompt builder com contexto mínimo. |
| AI-T-030 | Domínio | Safety gate, human handoff, limites de quota/tokens. |
| AI-T-040 | Infra | Timeout/falha DeepSeek/adapters HTTP — degradar sem dados inventados. |
| AI-T-050 | AuthZ | Rotas de configuração AI restritas ao tenant e papel. |

## Inventário atual

- Unit/integration diversos sob `application/services/__tests__`, `__tests__/*.spec.ts`
- E2E: `ai.e2e-spec.ts`, `commerce-context.e2e-spec.ts`, `commercial-live-ai.e2e-spec.ts`, etc.

## Lacunas (prioridade)

- **P0:** contratos estáveis para erros de adapter (códigos/mensagens) consumidos pelo cliente.
- **P1:** testes de carga controlada para Redis chat history sob eviction.

## Referências no código

- `AIModule`, handlers em `__tests__/`, adapters em `infrastructure`.
