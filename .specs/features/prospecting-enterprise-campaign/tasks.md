# Prospecting Enterprise Campaign Engine — Tasks

**Design**: `.specs/features/prospecting-enterprise-campaign/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation — Domínio + Schema (Sequential)

```
T1 → T2 → T3
```

T1: Schema Prisma (novos campos)
T2: ProspectCampaign entity + domain errors
T3: ProspectDispatchPolicy extensão

### Phase 2: Core — Messaging + Dispatch (Parallel onde possível)

```
T3 ──┬→ T4 (MessagingFacade + Adapter) ─┐
     ├→ T5 (DispatchExecutionUseCase)   ─┤→ T8 (DispatchNext + delay)
     └→ T6 (ExecutionStatus query)      ─┘
T7 (Webhook controller + use case) ──────→ independente
```

### Phase 3: Anti-Abuso + Integração (Sequential)

```
T8 → T9 (auto-pause block rate) → T10 (testes E2E + validação)
```

---

## Task Breakdown

### T1: Prisma Schema — ProspectCampaign + Contact fields

**What**: Adicionar campos de template e anti-abuso ao `ProspectCampaign`; adicionar `prospectingOptOut` ao `Contact`
**Where**: `src/api/prisma/schema.prisma`
**Depends on**: None
**Reuses**: Convenções de schema existentes (snake_case colunas, defaults explícitos)
**Requirement**: PROSP-01, PROSP-03, PROSP-05

**Done when**:
- [ ] `ProspectCampaign` tem campos: `template_name`, `language_code`, `template_variable_mapping`, `ai_variable_generation`, `cooldown_days`, `min_delay_seconds`, `max_delay_seconds`, `block_rate_threshold`
- [ ] `Contact` tem campos: `prospecting_opt_out`, `prospecting_opt_out_at`
- [ ] `npx prisma generate` passa sem erro
- [ ] `npx prisma migrate dev` gera migration sem breaking change
- [ ] TypeScript compila sem erros de tipo Prisma

**Tests**: none (schema change)
**Gate**: `cd src/api && npx prisma generate && npx prisma migrate dev`

**Commit**: `chore(prospecting): add template and anti-abuse fields to schema`

---

### T2: ProspectCampaign Entity + Domain Errors

**What**: Adicionar novos campos ao aggregate `ProspectCampaign` e criar domain errors específicos de prospecting
**Where**:
- `src/api/modules/prospecting/domain/entities/ProspectCampaign.ts`
- `src/api/modules/prospecting/domain/errors/ProspectingErrors.ts` (criar ou estender)
**Depends on**: T1
**Reuses**: Padrão de entidade existente; `ProspectExecution` como referência de estrutura
**Requirement**: PROSP-01, PROSP-02, PROSP-03

**Done when**:
- [ ] Entity aceita `templateName`, `languageCode`, `templateVariableMapping`, `aiVariableGeneration`, `cooldownDays`, `minDelaySeconds`, `maxDelaySeconds`, `blockRateThreshold`
- [ ] Domain errors criados: `ProspectAlreadyContactedError`, `ProspectCooldownActiveError`, `ProspectOptOutError`, `ProspectNoWhatsAppPhoneError`, `ProspectTemplateUnavailableError`
- [ ] Cada erro estende classe base de domain exception existente no projeto
- [ ] Unit tests cobrem construção da entity com novos campos e defaults
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=ProspectCampaign`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=ProspectCampaign`

**Commit**: `feat(prospecting): extend ProspectCampaign entity with template and anti-abuse config`

---

### T3: ProspectDispatchPolicy — Cooldown, Opt-Out, Phone Validation

**What**: Estender `ProspectDispatchPolicy` com validações de cooldown por contato, opt-out flag e ausência de WhatsApp phone
**Where**: `src/api/modules/prospecting/application/services/ProspectDispatchPolicy.ts`
**Depends on**: T2
**Reuses**: Policy existente; `ContactFacade.getContactById()`; `PrismaProspectExecutionRepository`
**Requirement**: PROSP-02, PROSP-03, PROSP-05

**Done when**:
- [ ] Policy rejeita dispatch quando `contact.prospectingOptOut === true` → lança `ProspectOptOutError`
- [ ] Policy rejeita quando `lastContactedAt` dentro de `cooldownDays` → lança `ProspectCooldownActiveError`
- [ ] Policy rejeita quando `attemptCount >= 1` e status `CONTACTED` → lança `ProspectAlreadyContactedError`
- [ ] Policy rejeita quando contato sem `whatsappPhone` → lança `ProspectNoWhatsAppPhoneError`
- [ ] `PrismaProspectExecutionRepository` tem método `findLastContactedAt(tenantId, contactId): Promise<Date | null>`
- [ ] Unit tests cobrem todos os 4 cenários de rejeição + cenário de sucesso
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=ProspectDispatchPolicy`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=ProspectDispatchPolicy`

**Commit**: `feat(prospecting): enforce cooldown, opt-out, and phone validation in dispatch policy`

---

### T4: MessagingFacade + WhatsAppTemplateMessageAdapter [P]

**What**: Adicionar método `queueTemplateMessage` à interface `MessagingFacade` e implementar `WhatsAppTemplateMessageAdapter` que chama Meta Cloud API
**Where**:
- `src/api/shared/application/facades/MessagingFacade.ts` (adicionar método)
- `src/api/modules/messaging/infrastructure/adapters/WhatsAppTemplateMessageAdapter.ts` (criar)
- Implementação concreta da facade no módulo messaging (adicionar método)
**Depends on**: T1, T2
**Reuses**: Interface `MessagingFacade` existente; padrão de adapter HTTP do módulo messaging; `WHATSAPP_ACCESS_TOKEN` env var já existente
**Requirement**: PROSP-01

**Done when**:
- [ ] `MessagingFacade` interface tem `queueTemplateMessage(params: QueueTemplateMessageParams): Promise<{conversationId, messageId}>`
- [ ] `QueueTemplateMessageParams` tipado: `{ tenantId, contactId, channel: 'WHATSAPP', templateName, languageCode, components: WhatsAppTemplateComponent[] }`
- [ ] `WhatsAppTemplateComponent` tipado para suportar `body` com `parameters` de tipo `text`
- [ ] Adapter constrói payload Meta API corretamente e faz POST para Cloud API endpoint
- [ ] Adapter lança `ProspectTemplateUnavailableError` quando Meta retorna erro de template inválido/inativo
- [ ] Unit tests mockam HTTP e cobrem: envio bem-sucedido, template inválido, erro de rede
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=WhatsAppTemplate`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=WhatsAppTemplate`

**Commit**: `feat(messaging): add queueTemplateMessage to facade and WhatsApp template adapter`

---

### T5: DispatchProspectExecutionUseCase — Template Branch [P]

**What**: Modificar use case para usar `queueTemplateMessage` quando campanha tem `templateName`; manter fallback texto livre; resolver variáveis do contato
**Where**: `src/api/modules/prospecting/application/use-cases/DispatchProspectExecutionUseCase.ts`
**Depends on**: T3, T4
**Reuses**: Lógica de substituição `{{name}}` existente (linha 102); `contactFacade.getContactById()`
**Requirement**: PROSP-01, PROSP-02

**Done when**:
- [ ] Quando `campaign.templateName` presente: chama `queueTemplateMessage` com variáveis resolvidas do contato
- [ ] Resolução de variáveis: `templateVariableMapping["1"] = "name"` → busca `contact.name`; suporta `name`, `firstName`, `segment`, `city`, `phone`
- [ ] Quando variável não encontrada: usa string vazia (não quebra dispatch)
- [ ] Quando `campaign.templateName` ausente: mantém comportamento atual (`queueSystemMessage`)
- [ ] Quando `ProspectTemplateUnavailableError` lançada: marca execução com `stopReason: TEMPLATE_UNAVAILABLE` e pausa campanha
- [ ] Policy chamada antes do dispatch (via T3); erros de policy mapeados para `stopReason` correto
- [ ] Unit tests cobrem: branch template, branch texto livre, template indisponível, policy rejection
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=DispatchProspectExecution`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=DispatchProspectExecution`

**Commit**: `feat(prospecting): dispatch via WhatsApp template with variable resolution`

---

### T6: ProspectExecutionStatus Query Endpoint [P]

**What**: Adicionar endpoint `GET /prospect-executions/status` que retorna status de prospecção por `contactIds` (para badge na UI)
**Where**:
- `src/api/modules/prospecting/infrastructure/persistence/repositories/PrismaProspectExecutionRepository.ts` (novo método)
- `src/api/modules/prospecting/presentation/controllers/ProspectExecutionController.ts` (novo endpoint)
**Depends on**: T2
**Reuses**: `ProspectExecutionController` existente; padrão de repository existente
**Requirement**: PROSP-02

**Done when**:
- [ ] Repository tem `findLatestByContactIds(tenantId, contactIds): Promise<ProspectExecutionSummary[]>`
- [ ] Query retorna execução mais recente por contactId (não todas)
- [ ] Endpoint `GET /prospect-executions/status?contactIds=id1,id2` retorna array com `{ contactId, status, lastContactedAt, stopReason, campaignName }`
- [ ] Endpoint escopo por `tenantId` (extraído do JWT)
- [ ] Status `NONE` retornado para contatos sem nenhuma execução
- [ ] Unit tests para repository method + controller
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=ProspectExecution`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=ProspectExecution`

**Commit**: `feat(prospecting): add execution status query endpoint for badge UI`

---

### T7: Meta Webhook Controller + HandleMetaQualityEventUseCase [P]

**What**: Controller que recebe webhooks Meta (GET challenge + POST eventos); use case que processa opt-out e auto-pause
**Where**:
- `src/api/modules/prospecting/presentation/controllers/MetaWebhookController.ts` (criar)
- `src/api/modules/prospecting/application/use-cases/HandleMetaQualityEventUseCase.ts` (criar)
**Depends on**: T2, T3
**Reuses**: Padrão de controller NestJS; `PauseProspectCampaignUseCase` existente; `ContactFacade`
**Requirement**: PROSP-05

**Done when**:
- [ ] `GET /meta/webhook` responde challenge de verificação Meta (`hub.challenge` param)
- [ ] `POST /meta/webhook` valida assinatura HMAC-SHA256 com `X-Hub-Signature-256` usando `crypto.timingSafeEqual`; retorna 403 se inválida
- [ ] Endpoint público (sem JWT guard); HMAC é o mecanismo de autenticação
- [ ] `HandleMetaQualityEventUseCase` processa evento e chama `contactFacade.markProspectingOptOut(tenantId, contactId)`
- [ ] `ContactFacade` tem método `markProspectingOptOut(tenantId, contactId): Promise<void>` adicionado
- [ ] Quando contato tem execução PENDING/CONTACTED: atualiza `stopReason: OPT_OUT`
- [ ] Unit tests cobrem: HMAC válido processa, HMAC inválido rejeita, evento sem execução correspondente → silencioso
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=MetaWebhook`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=MetaWebhook`

**Commit**: `feat(prospecting): add Meta quality webhook handler with HMAC validation`

---

### T8: DispatchNext + BullMQ Delay Randomizado

**What**: Modificar `DispatchNextProspectCampaignExecutionUseCase` para agendar próximo dispatch com delay randomizado; criar queue `prospecting-dispatch`
**Where**:
- `src/api/modules/prospecting/application/use-cases/DispatchNextProspectCampaignExecutionUseCase.ts`
- `src/api/modules/prospecting/prospecting.module.ts` (registrar nova queue)
**Depends on**: T5, T6, T7
**Reuses**: BullMQ queue existente como referência; padrão de registro de queue no `prospecting.module.ts:298`
**Requirement**: PROSP-03

**Done when**:
- [ ] Nova queue `prospecting-dispatch` registrada no módulo
- [ ] Após dispatch de uma execução, próxima é agendada com `delay = randomBetween(campaign.minDelaySeconds, campaign.maxDelaySeconds) * 1000`
- [ ] Job tem `attempts: 3` e `backoff: { type: 'exponential', delay: 5000 }`
- [ ] Quando `dailyLimit` atingido: job para e reagenda para meia-noite do próximo dia
- [ ] Unit tests cobrem: delay gerado dentro do range, reagendamento ao atingir dailyLimit
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=DispatchNext`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=DispatchNext`

**Commit**: `feat(prospecting): add randomized delay between dispatches via BullMQ`

---

### T9: Auto-Pause por Block Rate

**What**: Calcular block rate por campanha; pausar automaticamente quando exceder threshold; criar alerta para tenant
**Where**:
- `src/api/modules/prospecting/application/services/ProspectBlockRateService.ts` (criar)
- `src/api/modules/prospecting/application/use-cases/HandleMetaQualityEventUseCase.ts` (estender T7)
**Depends on**: T8
**Reuses**: `PauseProspectCampaignUseCase` existente; `PrismaProspectExecutionRepository`; AlertsModule (se disponível)
**Requirement**: PROSP-04

**Done when**:
- [ ] `ProspectBlockRateService.calculate(campaignId, windowDays: 7)` retorna `{ total, blocked, rate }`
- [ ] Cálculo: `rate = execuções com stopReason OPT_OUT / total execuções CONTACTED nos últimos 7 dias`
- [ ] `HandleMetaQualityEventUseCase` chama `ProspectBlockRateService` após marcar opt-out; se `rate > campaign.blockRateThreshold` → chama `PauseProspectCampaignUseCase`
- [ ] Campanha pausada por block rate tem `pauseReason: HIGH_BLOCK_RATE` (estender pause use case se necessário)
- [ ] Alert gerado para tenant (via AlertsModule ou log estruturado se módulo não disponível)
- [ ] Unit tests cobrem: rate abaixo threshold (não pausa), rate acima (pausa), campanha já pausada (idempotente)
- [ ] Gate check passa: `cd src/api && npm test -- --testPathPattern=ProspectBlockRate`

**Tests**: unit
**Gate**: `cd src/api && npm test -- --testPathPattern=ProspectBlockRate`

**Commit**: `feat(prospecting): auto-pause campaign on high block rate threshold`

---

### T10: E2E + Validação da Feature

**What**: E2E tests cobrindo fluxo completo: criar campanha com template → ativar → dispatch → badge → webhook opt-out → auto-pause
**Where**: `src/api/modules/prospecting/__tests__/prospecting-enterprise-campaign.e2e-spec.ts` (criar)
**Depends on**: T9
**Reuses**: Padrão de E2E existente no projeto; mock de `MessagingFacade`
**Requirement**: PROSP-01, PROSP-02, PROSP-03, PROSP-04, PROSP-05

**Done when**:
- [ ] E2E: criar campanha com `templateName` + `templateVariableMapping` → ativar → verificar execução chama `queueTemplateMessage`
- [ ] E2E: executar dispatch → verificar badge status endpoint retorna `CONTACTED`
- [ ] E2E: tentar re-dispatch para mesmo contato → verificar `PROSPECT_ALREADY_CONTACTED`
- [ ] E2E: simular webhook opt-out → verificar contato marcado + execução STOPPED
- [ ] E2E: simular block rate acima threshold → verificar campanha PAUSED
- [ ] Todos os testes passam: `cd src/api && npm run test:e2e -- --testPathPattern=prospecting-enterprise`
- [ ] Build passa: `cd src/api && npm run build`
- [ ] Lint passa: `cd src/api && npm run lint`

**Tests**: e2e
**Gate**: `cd src/api && npm run test:e2e -- --testPathPattern=prospecting-enterprise`

**Commit**: `test(prospecting): e2e coverage for enterprise campaign engine`

---

## Parallel Execution Map

```
Phase 1 (Sequential — Foundation):
  T1 ──→ T2 ──→ T3

Phase 2 (Parallel após T3):
  T3 complete, então:
    ├── T4 [P]  (MessagingFacade + Adapter)
    ├── T5 [P]  (DispatchExecution modificado)  ← depende de T3 + T4
    ├── T6 [P]  (Status query endpoint)
    └── T7 [P]  (Webhook controller)

  Nota: T5 depende de T4. Iniciar T4 e T6, T7 em paralelo.
  Após T4 completo → iniciar T5.

Phase 3 (Sequential — Integration):
  T5 + T6 + T7 completos → T8 → T9 → T10
```

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: Prisma schema fields | 1 arquivo, additive | ✅ Granular |
| T2: Entity + domain errors | 1-2 arquivos, coesos | ✅ Granular |
| T3: DispatchPolicy extensão | 1 serviço + 1 método repository | ✅ Granular |
| T4: Facade + Adapter | Interface + 1 adapter novo | ✅ Granular |
| T5: DispatchExecution modificação | 1 use case modificado | ✅ Granular |
| T6: Status query endpoint | 1 método repository + 1 endpoint | ✅ Granular |
| T7: Webhook + HandleQualityEvent | 1 controller + 1 use case (acoplados) | ✅ OK — coesos |
| T8: DispatchNext + BullMQ queue | 1 use case + 1 registro de queue | ✅ Granular |
| T9: Auto-pause + BlockRateService | 1 service novo + extensão T7 | ✅ Granular |
| T10: E2E validation | 1 arquivo de testes | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Mostra | Status |
|---|---|---|---|
| T1 | None | Início | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T1, T2 | T3 → T4 [P] | ✅ |
| T5 | T3, T4 | T4 → T5 (após T4 em paralelo) | ✅ |
| T6 | T2 | T3 → T6 [P] | ✅ |
| T7 | T2, T3 | T3 → T7 [P] | ✅ |
| T8 | T5, T6, T7 | T5+T6+T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |

---

## Test Co-location Validation

| Task | Layer Created/Modified | Requer | Task Diz | Status |
|---|---|---|---|---|
| T1 | Schema (infra) | none | none | ✅ |
| T2 | Domain entity + errors | unit | unit | ✅ |
| T3 | Application service | unit | unit | ✅ |
| T4 | Facade interface + infra adapter | unit | unit | ✅ |
| T5 | Application use case | unit | unit | ✅ |
| T6 | Repository método + controller | unit | unit | ✅ |
| T7 | Controller + use case | unit | unit | ✅ |
| T8 | Application use case + module config | unit | unit | ✅ |
| T9 | Application service + use case ext | unit | unit | ✅ |
| T10 | E2E spec | e2e | e2e | ✅ |

---

## Requirement → Task Traceability

| Requirement | Stories | Tasks |
|---|---|---|
| PROSP-01 | Template message send | T1, T2, T4, T5 |
| PROSP-02 | Badge + bloqueio reenvio | T2, T3, T5, T6 |
| PROSP-03 | Anti-abuso cooldown/delay | T2, T3, T8 |
| PROSP-04 | Auto-pause block rate | T9 |
| PROSP-05 | Webhook Meta qualidade | T7, T9 |
| PROSP-06 | IA variáveis (P3) | Não incluído nesta fase — deferred |
