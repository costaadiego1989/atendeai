# IMPLEMENTATION-GAP — `contacts` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `contacts` |
| Data | 2026-05-04 |
| API relacionada | `contact` (`ContactController`); abrir conversa cruza [`messaging`](../../../../api/modules/messaging/presentation/controllers/MessagingController.ts) |

## Superfície já coberta

- Cliente: [`services/contacts-service.ts`](./services/contacts-service.ts)
- Rotas utilizadas (resumo): CRUD lista/detalhe/update; `PATCH .../stage`; timeline; soft-delete `POST .../delete`; import CSV + jobs; relatórios sync/async + jobs download; `POST .../conversations/open-by-contact`.

Backend: [`ContactController.ts`](../../../../api/modules/contact/presentation/controllers/ContactController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-CNT-001 | P1 | Conferência linha-a-linha decorators `@Patch(':id')` vs método HTTP no client (`PATCH`/`PUT`) para update contact | `ContactController` |
| APP-CNT-002 | P1 | Paginação/meta se API devolver envelopes não espelhados em tipos TS partilhados | Contratos |

**Cliente (integração):** `contacts-service.updateContact` e `updateContactStage` já usam `apiClient.patch` nos paths esperados. `listContacts` aceita resposta em lista ou `{ data, meta }` e preenche `meta` por fallback quando a API não envia envelope — falta apenas validar contra o controller quando o código da API estiver no mesmo workspace.

## Alinhamento de contrato

- Query `branchId` em import/reports/report-jobs alinhada aos endpoints da API.

## Verificação (Done when)

- Smoke MSW/e2e: criar contacto, mudar estágio, abrir conversa associada com cookie válido.
