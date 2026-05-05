# TEST-SPEC — `prospecting`

## Objetivo

Campanhas outbound seguras (WhatsApp/meta), limites diários, LGPD/consentimento e filas Bull resilientes.

## IDs de cenários

Prefixo **`PROS-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| PROS-T-010 | Validação | Template variáveis obrigatórias; público vazio; canal inválido. |
| PROS-T-020 | Sucesso | Start campaign feliz com política de dispatch (`ProspectDispatchPolicy`). |
| PROS-T-030 | Domínio | Daily limit / estado campaign / audience mismatch. |
| PROS-T-040 | Infra | Processor async falha parcial — não marca envio fantasma. |
| PROS-T-050 | Compliance | Stop/opt-out/remove audience aplicados antes do próximo batch. |

## Inventário atual

- Cobertura unit forte (~35 ficheiros), cenários em `scenarios.md`.

## Lacunas (prioridade)

- **P0:** e2e reduzidos ou skipped em CI — garantir pelo menos smoke prospect-search-worker.
- **P1:** contratos estáveis de erro para UI de campanha.

## Referências no código

- `StartProspectCampaignUseCase`, `ProspectingAsyncJobProcessor`, `__tests__/scenarios.md`.
