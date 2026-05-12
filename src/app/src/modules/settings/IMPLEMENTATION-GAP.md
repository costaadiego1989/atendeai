# IMPLEMENTATION-GAP — `settings` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `settings` |
| Data | 2026-05-12 |
| API relacionada | `tenant` (`TenantController`, `UserController`, `InstagramMetaConnectionController`); fragmentos cruzam `sales`/promotions |

## Superfície já coberta

- [`services/company-settings-service.ts`](./services/company-settings-service.ts): `GET/PUT .../settings`, negócio, AI config, PDF resumes, promoções CRUD, branches CRUD, **profile-sections**, **onboarding-checklist**.
- [`services/channels-service.ts`](./services/channels-service.ts): WhatsApp Twilio, Instagram config, **Meta OAuth start** `POST /channels/instagram/meta/start`.

Backend: [`TenantController.ts`](../../../../api/modules/tenant/presentation/controllers/TenantController.ts), [`InstagramMetaConnectionController.ts`](../../../../api/modules/tenant/presentation/controllers/InstagramMetaConnectionController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-SET-001 | P1 | **Onboarding / perfil**: client + normalizer + componente `TenantOnboardingCard` implementados; `staleTime: 60s` evita chamadas duplicadas | [x] Resolvido 2026-05-12 |
| APP-SET-002 | P2 | Integrações externas `GET|POST /tenant/external/*` são fluxo API-key / parceiros — provável **N/A** para SPA tenant normal | [ ] N/A |
| APP-SET-003 | P1 | Dupla entrada Instagram: campo editável em `TenantBranchesTab` convertido para read-only com link para Canais; UX unificada em `ChannelsSettingsContent` | [x] Resolvido 2026-05-12 |

### Detalhes APP-SET-001

- `getProfileSections(tenantId)` — parseia resposta `{ marketing, technical }` do backend em rows de completude
- `getOnboardingChecklist(tenantId)` — parseia `{ items: [...] }` com `id`, `title`, `completed`
- `TenantOnboardingCard` renderiza ambos com progress bar
- Query keys: `tenant-profile-sections`, `tenant-onboarding-checklist` (invalidados em mutations)
- Cache: `staleTime: 60_000` — sem chamadas duplicadas

## Alinhamento de contrato

- Payloads AI (`PUT .../ai-config`) devem seguir campos obrigatórios backend.

## Verificação (Done when)

- Checklist QA para WhatsApp Twilio + Instagram (manual + OAuth).
- [x] Quando APP-SET-001 fechado: ecrã consome checklist sem chamadas duplicadas não cacheadas.
