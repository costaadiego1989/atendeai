# IMPLEMENTATION-GAP — `settings` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `settings` |
| Data | 2026-05-04 |
| API relacionada | `tenant` (`TenantController`, `UserController`, `InstagramMetaConnectionController`); fragmentos cruzam `sales`/promotions |

## Superfície já coberta

- [`services/company-settings-service.ts`](./services/company-settings-service.ts): `GET/PUT .../settings`, negócio, AI config, PDF resumes, promoções CRUD, branches CRUD.
- [`services/channels-service.ts`](./services/channels-service.ts): WhatsApp Twilio, Instagram config, **Meta OAuth start** `POST /channels/instagram/meta/start`.

Backend: [`TenantController.ts`](../../../../api/modules/tenant/presentation/controllers/TenantController.ts), [`InstagramMetaConnectionController.ts`](../../../../api/modules/tenant/presentation/controllers/InstagramMetaConnectionController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-SET-001 | P1 | **Onboarding / perfil**: `GET .../tenants/:id/profile-sections` e `GET .../onboarding-checklist` expostos na API mas **sem** cliente dedicado visível nos services actuais — avaliar dashboard ou página settings | `TenantController` |
| APP-SET-002 | P2 | Integrações externas `GET|POST /tenant/external/*` são fluxo API-key / parceiros — provável **N/A** para SPA tenant normal | [`IntegrationController`](../../../../api/modules/tenant/presentation/controllers/IntegrationController.ts) |
| APP-SET-003 | P1 | Dupla entrada Instagram: `PUT .../instagram-config` vs fluxo Meta OAuth — garantir UX única coerente | `TenantController` + `InstagramMetaConnectionController` |

## Alinhamento de contrato

- Payloads AI (`PUT .../ai-config`) devem seguir campos obrigatórios backend.

## Verificação (Done when)

- Checklist QA para WhatsApp Twilio + Instagram (manual + OAuth).
- Quando APP-SET-001 fechado: ecrã consome checklist sem chamadas duplicadas não cacheadas.
