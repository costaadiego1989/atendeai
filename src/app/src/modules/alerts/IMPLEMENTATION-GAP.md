# IMPLEMENTATION-GAP — `alerts` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `alerts` |
| Data | 2026-05-04 |
| API relacionada | `alerts` (`AlertReminderController`) |

## Superfície já coberta

- Cliente: [`services/alerts-service.ts`](./services/alerts-service.ts)
- Rotas utilizadas:
  - `GET /alerts/reminders` (`branchId` opcional)
  - `POST /alerts/reminders`
  - `PUT /alerts/reminders/:reminderId`
  - `DELETE /alerts/reminders/:reminderId`

Backend: [`src/api/modules/alerts/presentation/controllers/AlertReminderController.ts`](../../../../api/modules/alerts/presentation/controllers/AlertReminderController.ts)

- Paridade HTTP do controller confirmada para os métodos acima (sem paginação nem filtros extra nas queries).
- `POST /alerts/reminders` envia `timezone` IANA (`Intl.DateTimeFormat().resolvedOptions().timeZone`, fallback `America/Sao_Paulo`) conforme `CreateAlertReminderDTO`.

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-ALT-002 | P1 | Estados de erro de domínio exibidos com código estável (`DomainException`) | [`src/api/modules/alerts/TEST-SPEC.md`](../../../../api/modules/alerts/TEST-SPEC.md) |

## Alinhamento de contrato

- Payload `CreateAlertReminderInput` / `UpdateAlertReminderInput` vs DTOs Nest (`frequency`, `scheduledAt`, `timeOfDay`, `branchId`, `timezone`).

## Verificação (Done when)

- Testes MSW ou e2e smoke: criar/editar/apagar lembrete com `branchId` preenchido e vazio.
- Lista reflete atualização otimista ou invalidação de cache conforme padrão do módulo.
