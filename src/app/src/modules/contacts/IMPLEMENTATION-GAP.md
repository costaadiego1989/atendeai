# IMPLEMENTATION-GAP — `contacts` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `contacts` |
| Data | 2026-05-12 |
| API relacionada | `contact` (`ContactController`); abrir conversa cruza [`messaging`](../../../../api/modules/messaging/presentation/controllers/MessagingController.ts) |

## Superfície já coberta

- Cliente: [`services/contacts-service.ts`](./services/contacts-service.ts)
- Rotas utilizadas (resumo): CRUD lista/detalhe/update; `PATCH .../stage`; timeline; soft-delete `POST .../delete`; import CSV + jobs; relatórios sync/async + jobs download; `POST .../conversations/open-by-contact`.

Backend: [`ContactController.ts`](../../../../api/modules/contact/presentation/controllers/ContactController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-CNT-001 | P1 | Conferência decorators `@Patch(':id')` vs método HTTP no client — auditoria confirma alinhamento total | [x] Verificado 2026-05-12 |
| APP-CNT-002 | P1 | Paginação/meta — tipos `PageMeta` e `PaginatedResponse<T>` compartilhados em `@/shared/types`; contacts e messaging usam-nos | [x] Resolvido 2026-05-12 |

### Auditoria APP-CNT-001

| Operação | Backend decorator | Frontend HTTP | Path | Match |
|----------|-------------------|---------------|------|-------|
| Update contact | `@Patch(':id')` | `apiClient.patch` | `/tenants/:tenantId/contacts/:id` | OK |
| Update stage | `@Patch(':id/stage')` | `apiClient.patch` | `/tenants/:tenantId/contacts/:id/stage` | OK |

**Cliente (integração):** `contacts-service.updateContact` e `updateContactStage` já usam `apiClient.patch` nos paths esperados. `listContacts` aceita resposta em lista ou `{ data, meta }` e preenche `meta` por fallback quando a API não envia envelope.

## Alinhamento de contrato

- Query `branchId` em import/reports/report-jobs alinhada aos endpoints da API.
- HTTP verbs (PATCH) confirmados alinhados entre controller e client.

## Verificação (Done when)

- Smoke MSW/e2e: criar contacto, mudar estágio, abrir conversa associada com cookie válido.
- [x] Auditoria HTTP verbs backend vs frontend concluída.
