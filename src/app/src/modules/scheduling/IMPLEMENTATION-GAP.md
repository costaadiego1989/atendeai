# IMPLEMENTATION-GAP — `scheduling` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `scheduling` |
| Data | 2026-05-04 |
| API relacionada | `scheduling` (`SchedulingController`, `SchedulingGoogleCalendarController`) |

## Superfície já coberta

- Cliente: [`services/scheduling-service.ts`](./services/scheduling-service.ts)
- Rotas utilizadas (resumo): profissionais, categorias, disponibilidade (slots, reservations, reschedule), recurrences CRUD/cancel/delete; relatório async `report-jobs`, lista jobs, download; Google Calendar (`/scheduling/google-calendar/connection/*` exceto callback servidor).

Backend: [`SchedulingController.ts`](../../../../api/modules/scheduling/presentation/controllers/SchedulingController.ts), [`SchedulingGoogleCalendarController.ts`](../../../../api/modules/scheduling/presentation/controllers/SchedulingGoogleCalendarController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| ~~APP-SCH-001~~ | ~~P1~~ | ~~Payment link por slot~~ — `POST …/slots/:slotId/payment-link` exposto em [`scheduling-service`](./services/scheduling-service.ts); UI em [`SchedulingSlotDetailsSheet`](./components/SchedulingSlotDetailsSheet.tsx) | `SchedulingController` |
| ~~APP-SCH-002~~ | ~~P1~~ | ~~Relatório síncrono~~ — `generateReportSync` + toast em [`useSchedulingReportsViewModel`](./view-models/useSchedulingReportsViewModel.ts) | `SchedulingController` |
| ~~APP-SCH-003~~ | ~~P1~~ | ~~Detalhe job~~ — `getAsyncJob` + query focada no VM de relatórios | `SchedulingController` |
| APP-SCH-004 | P2 | Callback OAuth Google (`GET …/google-calendar/connection/callback`) é servidor/browser redirect — SPA só dispara `start` e `select-calendar` | `SchedulingGoogleCalendarController` |

**Fechados em app:** APP-SCH-001 a APP-SCH-003 (CSV async + lista jobs já existiam; lista jobs aceita envelope `{ data }`).

## Alinhamento de contrato

- `withBranchQuery` aplicado onde a API aceita `branchId` para evitar dados de filial errada (paths com query existente usam `&branchId=`).

## Verificação (Done when)

- ~~APP-SCH-001~~: UI cria payment link e atualiza detalhes do slot após sucesso.
- ~~APP-SCH-002~~: Botão “Ver resumo agora” no sheet de relatórios chama `POST …/reports`.
- ~~APP-SCH-003~~: Job atual exportação usa `GET …/jobs/:id` enquanto `QUEUED`/`PROCESSING`.
- Documentação explícita sobre uso ou não de `POST …/reports` (resumo síncrono vs CSV async).
