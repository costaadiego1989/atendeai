---
name: tenant-module-improvements
description:
  Continuidade das melhorias do módulo tenant (bootstrap, read models, canais WhatsApp/
  Instagram, observabilidade). Use quando trabalhar em `src/api/modules/tenant`,
  onboarding, projections marketing vs técnico, ACLs Dialog360/Twilio/Meta, ou ao alinhar
  com docs/api-modules-review/MODULE-tenant.md.
---

# Melhorias do módulo `tenant`

## Fonte de truth (brownfield)

- `docs/api-modules-review/MODULE-tenant.md` — valor, acoplamento, logs, KISS/WhatsApp vs messaging.

## Âmbito habitual

1. **Read models leves:** manter endpoints de projeção (ex.: `GET tenants/:id/profile-sections`) sem expor segredos; evoluir só com quebra controlada de contrato.
2. **Onboarding:** checklist derivada do estado do agregado + PDF resumes (`tenant_schema.tenant_pdf_resumes`).
3. **Observabilidade em adapters de canal:** `StructuredLogEmitter` com `tenantId` em falhas HTTP (ACLs WhatsApp Meta/360/Twilio, OAuth Instagram).
4. **KISS:** configuração WhatsApp no tenant (credenciais, webhook strategy) ≠ envio outbound no gateway de messaging — documentar ou extrair matriz única se duplicação aparecer.

## Convenções Nest

- Use cases registados como `Symbol` tokens em `tenant.module.ts` quando o projeto já faz assim.
- Guards: `JwtCookieGuard` + `TenantGuard` em rotas multitenant `:id`.

## Ao encerrar trabalho neste tema

Atualizar a ficha `MODULE-tenant.md` (data, endpoints, observabilidade) e uma linha na tabela de `docs/api-modules-review/ORCHESTRATOR.md` se o estado do módulo mudou materialmente.

## Relação com tlc-spec-driven

Alterações grandes (branches enterprise, migrações de modelo) devem usar spec/tasks em `.specs/features/` antes de refactor profundo no agregado `Tenant`.
