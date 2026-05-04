# Revisão de módulos da API (`src/api/modules`) — orquestrador

**Função:** fonte de verdade para acompanhamento contínuo de **valor ao utilizador**, **acoplamento**, **observabilidade (logs/traces)** e **KISS/DRY**.  
**Metodologia:** alinhado a *tlc-spec-driven* — esta pasta é revisão brownfield incremental (não substitui `spec.md` por feature).

**Como atualizar este conjunto de documentos**

1. Ao alterar um módulo em código, abrir a ficha `MODULE-<nome>.md` correspondente.
2. Ajustar secções **Última análise**, **Riscos / acoplamento** e **Observabilidade** se o impacto for relevante.
3. Atualizar a **tabela de estado** abaixo (data + nota de uma linha).
4. Registar decisões duradouras no bloco **Decisões globais** (fim deste ficheiro).

**Convenções das fichas**

| Secção | Conteúdo |
|--------|----------|
| Valor / oportunidades | Ideias que aumentam receita, retenção, eficiência operacional ou confiança do cliente final. |
| Acoplamento | Dependências entre módulos, imports de use cases concretos vs ports, riscos de ciclo Nest. |
| Logs / traces | Uso de `StructuredLogEmitter`, `DomainTrace.traceAsync/traceSync`, `traceId` em HTTP vs ausência nos workers. |
| KISS / DRY | Complexidade acidental, duplicação, `console.*` onde deveria ser log estruturado. |

**Estado sintético (atualizar a cada revisão)**

| Módulo | Ficha | Última revisão | Estado |
|--------|--------|----------------|--------|
| agent-rules | [MODULE-agent-rules.md](./MODULE-agent-rules.md) | 2026-05-03 | Preview + histórico HTTP; facade com `DomainTrace`; DTO/domínio 1500 caracteres |
| ai | [MODULE-ai.md](./MODULE-ai.md) | 2026-05-03 | Spans métricas (tokens+custo opcional); modo seguranca; cache agregador; timeouts DeepSeek/medida |
| alerts | [MODULE-alerts.md](./MODULE-alerts.md) | 2026-05-03 | TZ IANA Luxon; anti-spam + limite ativos; template env; spans worker Bull |
| auth | [MODULE-auth.md](./MODULE-auth.md) | 2026-05-03 | Rate limit Redis (IP + device) em login, refresh e recuperação de senha |
| billing | [MODULE-billing.md](./MODULE-billing.md) | 2026-05-03 | WhatsApp para quota warning/exceeded, CSV de uso, spans CheckQuota, trace processors Bull |
| catalog | [MODULE-catalog.md](./MODULE-catalog.md) | 2026-05-03 | Rascunho inicial |
| commerce | [MODULE-commerce.md](./MODULE-commerce.md) | 2026-05-03 | Rascunho inicial |
| contact | [MODULE-contact.md](./MODULE-contact.md) | 2026-05-03 | Rascunho inicial |
| inventory | [MODULE-inventory.md](./MODULE-inventory.md) | 2026-05-03 | Rascunho inicial |
| messaging | [MODULE-messaging.md](./MODULE-messaging.md) | 2026-05-03 | `BillingQuotaMessagingHandlers` (consumidores quota billing → WhatsApp dono) |
| payment | [MODULE-payment.md](./MODULE-payment.md) | 2026-05-03 | Rascunho inicial |
| platform-admin | [MODULE-platform-admin.md](./MODULE-platform-admin.md) | 2026-05-03 | Rascunho inicial |
| prospecting | [MODULE-prospecting.md](./MODULE-prospecting.md) | 2026-05-03 | Rascunho inicial |
| recovery | [MODULE-recovery.md](./MODULE-recovery.md) | 2026-05-04 | Playbooks docs (LGPD, métricas, modelo configurável); código inalterado nesta revisão |
| sales | [MODULE-sales.md](./MODULE-sales.md) | 2026-05-04 | Logs criação link + remarketing overdue WhatsApp; SKU opcional no link |
| scheduling | [MODULE-scheduling.md](./MODULE-scheduling.md) | 2026-05-04 | Logs; idempotência payment.confirmed; TZ lembretes; hold pré-pagamento configurable + auto-cancel logs |
| social | [MODULE-social.md](./MODULE-social.md) | 2026-05-03 | Rascunho inicial |
| support | [MODULE-support.md](./MODULE-support.md) | 2026-05-03 | `appModule` + log criação; UI FAB contextual por rota (`ModuleFeedbackFab`) |
| tenant | [MODULE-tenant.md](./MODULE-tenant.md) | 2026-05-03 | Read API `profile-sections` + onboarding checklist; ACLs canal com StructuredLogEmitter + tenantId |

**Legenda de estado:** `Rascunho inicial` → primeira passagem só com inspeção estática do repo; `Em curso` → alterações planejadas; `Revisto após refactor` → ficha validada contra código recente.

---

## Panorama técnico (baseline 2026-05-03)

- **HTTP:** `HttpStructuredLoggingInterceptor` + `GlobalExceptionFilter` emitem logs com `traceId` / `spanId` quando o contexto OTEL está ativo (`shared/infrastructure`).
- **`DomainTrace`:** `traceAsync` / `traceSync` (`shared/infrastructure/observability/DomainTrace.ts`) — em `modules/billing`, `CheckQuotaUseCase`, **`RecordUsageUseCase`** (`billing.record_usage`), facade **`TenantAgentRuleService`**, **pipeline IA** (`ai.ProcessAIResponseService`, `DeepSeekAdapter`, `AIContextAggregator`, `MediaUnderstandingService`, adapters HTTP de midia) e **workers de alertas** (`alerts.AlertReminderProcessor`, job Bull).

- **`AIModule`** importa muitos módulos Nest e injeta **use cases concretos** de outros domínios (`AdvanceCommerceConversationUseCase`, `ReserveProfessionalSlotUseCase`) — forte acoplamento de composição; mitigar com ports/interfaces dedicados ou antecipação só via **event bus** onde fizer sentido.
- **Padrões úteis já presentes:** `ContactFacade`, `MessagingFacade`, `ITenantFacade`; integration events (`PaymentIntegrationEvents`, scheduling, commerce); tokens `ICheckQuotaUseCase` / `IRecordUsageUseCase` para billing.
- **Gaps típicos:** workers BullMQ, processors e adapters com pouca correlação explícita; alguns `console.log` em serviços de domínio (ex.: fluxo social) em vez de `StructuredLogEmitter`.

---

## Decisões globais (preencher ao longo do tempo)

| Data | Decisão |
|------|---------|
| 2026-05-03 | Criada estrutura `docs/api-modules-review/` como fonte de verdade para revisão brownfield dos módulos da API. |
| 2026-05-03 | Auth `DeviceAwareThrottlerGuard`: só dois contadores (IP + device id); fallback estável quando sem cookie/header; opcional `.env` `AUTH_THROTTLE_*`. |
| 2026-05-03 | CSV e outras rotas brutas: decorador `@SkipSuccessEnvelope`; `SuccessResponseInterceptor` usa `Reflector` no bootstrap. |
| 2026-05-03 | Billing: WhatsApp ao dono quando `billing.quota-warning` / `billing.quota-exceeded` (handlers no módulo messaging). |

---

## Próximas ondas sugeridas (não obrigatórias — priorizar com produto)

1. Cobrir **tracing de domínio** nos use cases de maior custo/latência (IA, outbound messaging, checkout).
2. Substituir **logs ad-hoc** (`console.*`) em serviços críticos por payload estruturado com `tenantId` e `correlation` quando disponível.
3. Reduzir **imports de classes concretas** entre módulos (especialmente `ai.module` e `ProcessAIResponseService`).
