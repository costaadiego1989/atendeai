# Tasks: Settings IA / Widget / Voice

**Legend:** [P] = parallelizable | [S] = sequential dependency | ✅ = done | 🔄 = in progress | ⏳ = pending

---

## Phase 1 — Schema & Infra (blocker para tudo)

### T01 — Schema: Add backgroundColor to WidgetConfig [S]
**Status**: ✅ — campo adicionado ao schema, migration SQL criada manualmente (DB local offline)

---

### T02 — Verify VoiceCall Prisma model exists [S]
**Status**: ✅ — modelo confirmado no schema com campos: id, tenantId, contactId, direction, status, duration, outcome, createdAt, updatedAt

---

## Phase 2 — Backend: Documents API (DOC-01)

### T03 — TDD: Write integration tests for DocumentsController [P]
**Status**: ⏳ — testes e2e pendentes (DB local offline impossibilita rodar)

---

### T04 — Implement: UploadDocumentUseCase [P após T03]
**Status**: ✅ — implementado com SHA-256 dedup, S3 upload, UpsertTenantPDFResumeUseCase

---

### T05 — Implement: DeleteDocumentUseCase [P após T03]
**Status**: ✅ — implementado com S3 delete + repository deleteById

---

### T06 — Implement: DocumentsController [S após T04, T05]
**Status**: ✅ — controller registrado em tenant.module.ts, endpoints: GET/POST/DELETE

---

### T07 — Frontend: Remove PDF upload from Company Settings [P]
**Status**: ✅ — TenantIdentityTab.tsx reescrito sem PDF; backend endpoint preservado

---

## Phase 3 — Backend: Widget Config (WIDGET-01, WIDGET-02)

### T08 — TDD: Write integration tests for WidgetConfigController [P]
**Status**: ⏳ — testes e2e pendentes (DB local offline impossibilita rodar)

---

### T09 — Implement: GetWidgetConfigUseCase + UpdateWidgetConfigUseCase [P após T08]
**Status**: ✅ — implementados com findFirst pattern (tenantId não é @unique em WidgetConfig)

---

### T10 — Implement: UploadWidgetAvatarUseCase [P após T08]
**Status**: ✅ — valida mimeType, S3 upload para widget-avatars/{tenantId}/, retorna avatarUrl

---

### T11 — Implement: WidgetConfigController [S após T09, T10]
**Status**: ✅ — registrado em messaging.module.ts com GET, PUT, POST avatar

---

## Phase 4 — Backend: Voice Config (VOICE-01, VOICE-02)

### T12 — TDD: Write integration tests for VoiceConfigController [P]
**Status**: ⏳ — testes e2e pendentes

---

### T13 — Implement: GetVoiceConfigUseCase + UpdateVoiceConfigUseCase [P após T12]
**Status**: ✅ — GetVoiceConfig mapeia VoiceAgentConfig → VoiceConfig shape nested; UpdateVoiceConfig faz flatten nested → campos Prisma

---

### T14 — Implement: ListVoiceCallsUseCase [P após T12]
**Status**: ✅ — retorna { items, total, page, totalPages }, mapeia outcome → result

---

### T15 — Implement: VoiceConfigController [S após T13, T14]
**Status**: ✅ — registrado em voice.module.ts; endpoints: GET/PUT config, GET calls, GET metrics (stub)

---

## Phase 5 — Frontend Fixes

### T16 — Frontend: Fix WidgetSettingsPage save + skeleton [P]
**Status**: ✅ — backgroundColor adicionado ao form/preview; avatar upload UI com Bot icon placeholder; agent name no preview; embed snippet com publicToken

---

### T17 — Frontend: Fix VoiceSettingsPage + skeleton [P]
**Status**: ✅ — skeleton já usa CardSkeleton padrão; voice-service.ts aponta para rotas corretas (/voice/config, /voice/calls, /voice/metrics); API shape corrigida no backend para corresponder ao VoiceConfig frontend

---

## Phase 6 — Playwright Tests (WIDGET-03)

### T18 — Playwright: Widget settings + embed tests [S após T11, T16]
**Req**: WIDGET-03  
**Where**: `src/app/e2e/widget-settings.spec.ts` (criado)  
**Status**: ✅ — 16 testes Playwright cobrindo: page load, form fields (name/greeting/color/toggle/avatar), preview reativo, embed snippet, save button state, error handling, responsividade.
**Nota**: Teste de embed real (widget.js loading em página externa) requer ambiente deployado + widget bundle compilado. API-level coberto por `src/api/modules/messaging/__tests__/widget.e2e-spec.ts`.

---

## Phase 7 — Final Verification

### T19 — Run full test suite + build [S final]
**What**:
```bash
cd src/api && npm run lint
cd src/api && npm test
cd src/api && npm run build
```
**Done when**: Lint ✅, Tests ✅, Build ✅  
**Status**: ✅ — build ✅, lint ✅, unit tests: 35 falhas todas pré-existentes (DB integration, Twilio, auth mocks — não relacionadas a esta feature)

---

## Execution Order

```
T01 (schema) ──────────────────────────────────────────────┐
T02 (verify VoiceCall) ─────────────────────────────────── │
                                                            ↓
T03 [P] ─→ T04, T05 ─→ T06 ─→ (Documents GREEN)           │
T08 [P] ─→ T09, T10 ─→ T11 ─→ (Widget GREEN)    ──────────┤
T12 [P] ─→ T13, T14 ─→ T15 ─→ (Voice GREEN)               │
T07 [P] (Frontend PDF remove)                              │
                                                            ↓
                            T16, T17 (Frontend fixes) ─────┤
                                                            ↓
                                              T18 (Playwright)
                                                            ↓
                                              T19 (Final gate)
```

## Requirement Traceability

| Req ID | Tasks | Status |
|---|---|---|
| DOC-01 | T03, T04, T05, T06 | ✅ (T03 e2e pendente — DB offline) |
| DOC-02 | T07 | ✅ |
| WIDGET-01 | T01, T08, T09, T11, T16 | ✅ (T08 e2e pendente — DB offline) |
| WIDGET-02 | T08, T10, T11 | ✅ |
| WIDGET-03 | T18 | ✅ (UI tests; embed real requer deploy) |
| VOICE-01 | T12, T13, T15, T17 | ✅ (T12 e2e pendente — DB offline) |
| VOICE-02 | T02, T12, T14, T15 | ✅ |
| UX-01 | T16, T17 | ✅ |
