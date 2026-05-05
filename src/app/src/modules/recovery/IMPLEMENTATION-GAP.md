# IMPLEMENTATION-GAP — `recovery` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `recovery` |
| Data | 2026-05-04 |
| API relacionada | `recovery` (`RecoveryController`) |

## Superfície já coberta

- Cliente: [`services/RecoveryService.ts`](./services/RecoveryService.ts)
- Rotas utilizadas (resumo): playbooks CRUD/activate; cases list/detail/status; outreach; guidance; payment-link; recurring charges; report **jobs** + download; mapeia a maior parte dos endpoints `cases` e `playbooks`.

Backend: [`RecoveryController.ts`](../../../../api/modules/recovery/presentation/controllers/RecoveryController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| ~~APP-REC-001~~ | ~~P1~~ | ~~Relatório síncrono~~ — [`RecoveryService.generateReportSync`](./services/RecoveryService.ts) + [`syncReportSummaryMutation`](./view-models/useRecoveryPageViewModel.ts) | `RecoveryController` |
| ~~APP-REC-002~~ | ~~P1~~ | ~~Polling por job~~ — [`getAsyncJob`](./services/RecoveryService.ts) + query focada no VM da página | `RecoveryController` |

**Nota:** CSV async (`report-jobs` + lista + download) já estava coberto.

## Alinhamento de contrato

- Tipos playbook/case devem seguir enums e estados devolvidos pela API após mudanças de playbook configurável.

## Verificação (Done when)

- Fluxo criar caso → guidance → envio com MSW ou e2e reduzido.
- ~~Decisão sobre endpoint síncrono `POST …/reports`~~ — em uso para “Ver resumo agora”; CSV continua pelo fluxo async.
