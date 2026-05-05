# Análise e Bateria de Testes — Módulo Tenant

Análise completa do domínio, cobertura atual e proposta de testes unitários e E2E para blindar o módulo `tenant`.

---

## Resumo do Domínio

| Camada | Artefatos |
|---|---|
| **Entities** | `Tenant` (Aggregate Root), `User` (Aggregate Root), `TenantBranch`, `AIConfig`, `WhatsAppConfig`, `InstagramConfig` |
| **Value Objects** | `CNPJ`, `CompanyName`, `Email`, `Phone`, `Plan`, `Promotion`, `Role`, `Address` |
| **Domain Events** | `TenantCreated`, `TenantPlanChanged`, `WhatsAppConfigured`, `InstagramConfigured`, `AIConfigUpdated`, `UserCreated` |
| **Repository Interfaces** | `ITenantRepository` (15 métodos), `IUserRepository` (7 métodos) |
| **Use Cases** | 20 use cases (tenant + user + branch + promotions + WhatsApp/Twilio + AI + Instagram + Trial) |
| **Handlers** | `TenantSubscriptionStatusHandler`, `TrialPaymentConfirmedHandler` |
| **Services** | `TenantDomainEventPublisher`, `UserDomainEventPublisher`, `TenantAuditService`, `TenantSchemaBootstrapService` |
| **Facades** | `TenantFacade` (inter-module boundary) |
| **Controllers** | `TenantController` (18 endpoints), `UserController` (4 endpoints), `IntegrationController` (2 endpoints) |

---

## Cobertura Atual (27 arquivos de teste)

### ✅ Testes Unitários Existentes (16)
| Arquivo | Status |
|---|---|
| `CreateTenantUseCase.spec.ts` | ✅ 3 cenários |
| `CreateExternalTenantUseCase.spec.ts` | ✅ Básico |
| `CreateUserUseCase.spec.ts` | ✅ Básico |
| `UpdateUserUseCase.spec.ts` | ✅ Básico |
| `DeleteUserUseCase.spec.ts` | ✅ Básico |
| `GetUsersByTenantUseCase.spec.ts` | ✅ Básico |
| `GetTenantDetailsUseCase.spec.ts` | ✅ Básico |
| `GetTenantSettingsUseCase.spec.ts` | ✅ Básico |
| `ConfigureAIUseCase.spec.ts` | ✅ Básico |
| `ConfigureInstagramUseCase.spec.ts` | ✅ Básico |
| `ConfigureWhatsAppUseCase.spec.ts` | ✅ Básico |
| `AddPromotionUseCase.spec.ts` | ✅ Básico |
| `UpdatePromotionUseCase.spec.ts` | ✅ Básico |
| `DeletePromotionUseCase.spec.ts` | ✅ Básico |
| `UpdateBusinessDataUseCase.spec.ts` | ✅ Básico |
| `RegisterTwilioWhatsAppSenderUseCase.spec.ts` | ✅ Básico |
| `TenantDomainEventPublisher.spec.ts` | ✅ Básico |
| `UserDomainEventPublisher.spec.ts` | ✅ Básico |
| `TenantFacade.spec.ts` | ✅ Básico |

### ✅ Testes de Integração Existentes (2)
| Arquivo | Status |
|---|---|
| `PrismaTenantRepository.integration.spec.ts` | ✅ |
| `PrismaUserRepository.integration.spec.ts` | ✅ |

### ✅ Testes E2E Existentes (4)
| Arquivo | Status |
|---|---|
| `tenant.e2e-spec.ts` | ✅ Onboarding, CRUD business data, promotions, AI, WhatsApp |
| `tenant-controller-guards.e2e-spec.ts` | ✅ Auth guards |
| `user-controller.e2e-spec.ts` | ✅ CRUD users |
| `integration-controller.e2e-spec.ts` | ✅ External subscribe, config |
| `branch-active-scope.e2e-spec.ts` | ✅ Branch scoping cross-module |

---

## Lacunas Identificadas (Gaps)

### 🔴 Domínio — Sem cobertura unitária
Nenhuma entidade, value object ou domain event possui teste unitário isolado. Isso é **crítico** porque são os blocos fundamentais de invariantes.

> [!CAUTION]
> Sem testes de domínio, regressões em validações (CNPJ, Email, Phone, Plan) e comportamento de métodos de mutação (changePlan, configureWhatsApp, etc.) passam despercebidas.

### 🟡 Use Cases — Cobertura rasa
Os testes existentes cobrem o "happy path" + 1 cenário de erro. Faltam:
- Edge cases de validação (ex: Plan inválido, CNPJ inválido no update)
- Cenários de concorrência / idempotência
- Testes de auditoria (verifica se `TenantAuditService.record()` é chamado corretamente)

### 🟡 Services/Handlers — Cobertura parcial
- `TenantSubscriptionStatusHandler` — **sem teste**
- `TrialPaymentConfirmedHandler` — **sem teste**
- `TenantAuditService` — **sem teste** (verificar fallback silencioso)
- `TenantSchemaBootstrapService` — **sem teste**

### 🟡 Use Cases completamente sem teste
- `CreateTenantBranchUseCase` — **sem teste unitário**
- `UpdateTenantBranchUseCase` — **sem teste unitário**
- `DeleteTenantBranchUseCase` — **sem teste unitário**
- `OnboardTrialTenantUseCase` — **sem teste unitário**
- `UpdateTenantPlanStatusUseCase` — **sem teste unitário**
- `RefreshTwilioWhatsAppSenderStatusUseCase` — **sem teste unitário**
- `VerifyTwilioWhatsAppSenderUseCase` — **sem teste unitário**
- `GetWhatsAppConnectionUseCase` — **sem teste unitário**

### 🟡 E2E — Gaps de cenários
- Branch CRUD via controller (POST/PUT/DELETE `/tenants/:id/branches`)
- Twilio WhatsApp sender registration flow (POST sender, verify, refresh)
- Settings endpoint com dados completos (audits + branches + channels)
- Instagram config via controller
- WhatsApp connection endpoint
- Error responses detalhados (DTO validation)
- Tenant details com dados de endereço e promoções completas

---

## Proposta de Bateria de Testes

### FASE 1 — Testes Unitários de Domínio (Priority: 🔴 CRITICAL)

#### 1.1 Value Objects

##### `CNPJ.spec.ts`
- `[NEW]` Deve criar CNPJ com formato válido (com máscara)
- `[NEW]` Deve criar CNPJ com formato válido (sem máscara)
- `[NEW]` Deve armazenar valor formatado (XX.XXX.XXX/XXXX-XX)
- `[NEW]` Deve rejeitar CNPJ com menos de 14 dígitos
- `[NEW]` Deve rejeitar CNPJ com mais de 14 dígitos
- `[NEW]` Deve rejeitar CNPJ com todos dígitos iguais (11.111.111/1111-11)
- `[NEW]` Deve rejeitar CNPJ com dígito verificador inválido
- `[NEW]` `toClean()` deve retornar somente dígitos

##### `CompanyName.spec.ts`
- `[NEW]` Deve criar nome com pelo menos 2 caracteres
- `[NEW]` Deve rejeitar nome com menos de 2 caracteres
- `[NEW]` Deve rejeitar nome vazio
- `[NEW]` Deve rejeitar nome com mais de 255 caracteres
- `[NEW]` Deve aplicar trim no valor

##### `Email.spec.ts`
- `[NEW]` Deve criar email válido
- `[NEW]` Deve converter para lowercase
- `[NEW]` Deve aplicar trim
- `[NEW]` Deve rejeitar email sem @
- `[NEW]` Deve rejeitar email sem domínio
- `[NEW]` Deve rejeitar string vazia

##### `Phone.spec.ts`
- `[NEW]` Deve criar phone com formato rawBR (11999999999)
- `[NEW]` Deve adicionar +55 automaticamente
- `[NEW]` Deve manter +55 quando já presente
- `[NEW]` Deve remover caracteres não-numéricos
- `[NEW]` Deve rejeitar número inválido (muito curto)

##### `Plan.spec.ts`
- `[NEW]` Deve criar plano ESSENCIAL
- `[NEW]` Deve criar plano PROFISSIONAL
- `[NEW]` Deve criar plano ESCALA
- `[NEW]` Deve ser case-insensitive (aceitar 'essencial')
- `[NEW]` Deve rejeitar plano inexistente
- `[NEW]` Factory methods: `essencial()`, `isEssencial()`, `isProfissional()`, `isEscala()`

##### `Promotion.spec.ts`
- `[NEW]` Deve criar promoção válida com todos os campos
- `[NEW]` Deve gerar UUID automático quando id não informado
- `[NEW]` Deve manter id quando informado
- `[NEW]` Deve rejeitar título com menos de 3 caracteres
- `[NEW]` Deve rejeitar descrição com menos de 10 caracteres
- `[NEW]` Deve rejeitar expiresAt com data inválida
- `[NEW]` Deve aceitar expiresAt com data válida
- `[NEW]` Campos opcionais (imageUrl, expiresAt, assignedUserId) devem ser undefined quando não informados

##### `Address.spec.ts`
- `[NEW]` Deve criar endereço válido
- `[NEW]` Deve retornar null quando todos campos estão vazios
- `[NEW]` `toValue()` deve retornar objeto plain

##### `Role.spec.ts`
- `[NEW]` Deve criar role OWNER / ADMIN / MEMBER (testar via import compartilhado)

---

#### 1.2 Entidades

##### `Tenant.spec.ts`
- `[NEW]` `create()` deve gerar id quando não fornecido
- `[NEW]` `create()` deve inferir ownerUserId do user com role OWNER
- `[NEW]` `create()` deve gerar apiKey UUID quando não fornecida
- `[NEW]` `create()` deve disparar evento TenantCreated quando id não fornecido
- `[NEW]` `create()` NÃO deve disparar TenantCreated quando id é fornecido (reconstitute pattern)
- `[NEW]` `create()` com isTrial deve setar planStatus como TRIALING
- `[NEW]` `create()` sem isTrial deve setar planStatus como ACTIVE
- `[NEW]` `reconstitute()` deve reconstruir sem disparar eventos
- `[NEW]` `updateBusinessData()` deve atualizar businessType
- `[NEW]` `updateBusinessData()` deve atualizar cnpj via CNPJ.create
- `[NEW]` `updateBusinessData()` deve ignorar campos undefined (não sobrescrever)
- `[NEW]` `updateBusinessData()` deve atualizar updatedAt
- `[NEW]` `configureWhatsApp()` deve setar whatsAppConfig e disparar WhatsAppConfigured
- `[NEW]` `configureInstagram()` deve setar instagramConfig e disparar InstagramConfigured
- `[NEW]` `configureAI()` deve setar aiConfig e disparar AIConfigUpdated
- `[NEW]` `changePlan()` deve atualizar plan e disparar TenantPlanChanged com old/new
- `[NEW]` `changePlan()` com newPlanStatus deve atualizar planStatus
- `[NEW]` `updatePlanStatus()` deve atualizar planStatus sem evento
- `[NEW]` `setOwner()` deve atualizar ownerUserId
- `[NEW]` `isWhatsAppConfigured()` / `isAIConfigured()` / `isInstagramConfigured()` boolean getters
- `[NEW]` `owner` getter deve retornar user correto ou undefined

##### `User.spec.ts`
- `[NEW]` `create()` deve gerar id quando não fornecido
- `[NEW]` `create()` deve disparar UserCreated quando id não fornecido
- `[NEW]` `create()` deve rejeitar nome com menos de 3 caracteres
- `[NEW]` `create()` deve rejeitar nome vazio
- `[NEW]` `reconstitute()` deve reconstruir sem disparar eventos
- `[NEW]` `updateName()` deve atualizar nome e updatedAt
- `[NEW]` `updateName()` deve rejeitar nome curto
- `[NEW]` `updatePhone()` deve atualizar via Phone.create
- `[NEW]` `updateEmail()` deve atualizar via Email.create
- `[NEW]` `updateCpf()` deve atualizar via CPF.create
- `[NEW]` `changeRole()` deve atualizar role
- `[NEW]` `updatePasswordHash()` deve atualizar hash
- `[NEW]` `requirePasswordChange()` deve setar mustChangePassword = true
- `[NEW]` `clearPasswordChangeRequirement()` deve setar mustChangePassword = false
- `[NEW]` `cpf` getter deve retornar null quando não definido

##### `TenantBranch.spec.ts`
- `[NEW]` `create()` deve criar branch válida
- `[NEW]` `create()` deve rejeitar nome com menos de 2 caracteres
- `[NEW]` `create()` deve limpar CNPJ (remover não-numéricos)
- `[NEW]` `create()` deve setar null em whatsAppConfigOverride quando credentials vazias
- `[NEW]` `create()` deve gerar id quando não fornecido
- `[NEW]` Getters retornam imutável copy de whatsAppConfigOverride

##### `AIConfig.spec.ts`
- `[NEW]` `create()` deve criar config válida
- `[NEW]` `create()` deve rejeitar systemPrompt com menos de 10 chars
- `[NEW]` `create()` deve rejeitar confidenceThreshold < 0 ou > 1
- `[NEW]` `create()` deve rejeitar maxTokensPerResponse < 50 ou > 4000
- `[NEW]` `create()` deve default salesInstructions para null
- `[NEW]` `reconstitute()` deve reconstruir sem validação

##### `WhatsAppConfig.spec.ts`
- `[NEW]` `create()` deve criar com provider BUBBLEWHATS
- `[NEW]` `create()` deve validar credentials por provider (id, token, apiUrl para BUBBLEWHATS)
- `[NEW]` `create()` deve validar apiKey para D360
- `[NEW]` `create()` deve rejeitar whatsappNumber vazio
- `[NEW]` `create()` deve rejeitar provider vazio
- `[NEW]` `create()` deve rejeitar credentials vazias
- `[NEW]` `create()` deve iniciar com status PENDING_VERIFICATION
- `[NEW]` `activate()` deve mudar status para ACTIVE
- `[NEW]` `credentials` getter deve retornar cópia defensiva

##### `InstagramConfig.spec.ts`
- `[NEW]` `create()` deve criar config válida
- `[NEW]` `create()` deve rejeitar metaAccessToken vazio
- `[NEW]` `create()` deve rejeitar instagramAccountId vazio
- `[NEW]` `create()` deve rejeitar webhookSecret vazio
- `[NEW]` `create()` deve iniciar com status PENDING_VERIFICATION
- `[NEW]` `activate()` deve mudar status para ACTIVE

---

### FASE 2 — Testes Unitários de Use Cases (Priority: 🟡 HIGH)

#### Novos Use Cases sem teste:

##### `CreateTenantBranchUseCase.spec.ts`
- `[NEW]` Deve criar branch e registrar auditoria
- `[NEW]` Deve retornar id e name da branch criada

##### `UpdateTenantBranchUseCase.spec.ts`
- `[NEW]` Deve atualizar branch e registrar auditoria
- `[NEW]` Deve retornar dados atualizados

##### `DeleteTenantBranchUseCase.spec.ts`
- `[NEW]` Deve deletar branch e registrar auditoria
- `[NEW]` Deve retornar success: true

##### `OnboardTrialTenantUseCase.spec.ts`
- `[NEW]` Deve chamar CreateTenantUseCase com isTrial=true e CNPJ placeholder
- `[NEW]` Deve gerar senha temporária

##### `UpdateTenantPlanStatusUseCase.spec.ts`
- `[NEW]` Deve atualizar status para ACTIVE
- `[NEW]` Deve atualizar status para EXPIRED
- `[NEW]` Deve lançar EntityNotFoundException para tenant inexistente

##### `GetWhatsAppConnectionUseCase.spec.ts`
- `[NEW]` Deve retornar connection null quando tenant não tem WhatsApp configurado
- `[NEW]` Deve retornar dados de connection quando configurado
- `[NEW]` Deve retornar embedded signup config do ConfigService
- `[NEW]` Deve lançar NotFoundException para tenant inexistente

##### `RefreshTwilioWhatsAppSenderStatusUseCase.spec.ts`
- `[NEW]` Deve atualizar status via TwilioManagementAcl
- `[NEW]` Deve ativar config quando status ONLINE
- `[NEW]` Deve lançar erro quando provider não é TWILIO
- `[NEW]` Deve lançar erro quando senderSid não está configurado
- `[NEW]` Deve lançar EntityNotFoundException para tenant sem config

##### `VerifyTwilioWhatsAppSenderUseCase.spec.ts`
- `[NEW]` Deve verificar sender via TwilioManagementAcl
- `[NEW]` Deve ativar config quando status ONLINE
- `[NEW]` Deve lançar erro quando provider não é TWILIO
- `[NEW]` Deve lançar erro quando senderSid não está configurado

#### Aprofundamento de Use Cases existentes:

##### `CreateTenantUseCase.spec.ts` (adicionar)
- `[NEW]` Deve setar businessType quando informado no input
- `[NEW]` Deve defaultar para plan PROFISSIONAL quando plan não é informado
- `[NEW]` Deve lançar erro para plano inválido
- `[NEW]` Deve rejeitar email inválido
- `[NEW]` Deve rejeitar CNPJ com formato inválido

##### `AddPromotionUseCase.spec.ts` (adicionar)
- `[NEW]` Deve resolver assignedUserName via UserRepository quando assignedUserId informado
- `[NEW]` Deve lançar NotFoundException quando assignedUserId não pertence ao tenant
- `[NEW]` Deve registrar auditoria com metadata de promotionId

##### `UpdatePromotionUseCase.spec.ts` (adicionar)
- `[NEW]` Deve lançar NotFoundException quando promotionId não existe no tenant
- `[NEW]` Deve manter o mesmo id da promoção
- `[NEW]` Deve registrar auditoria com metadata de promotionId

##### `DeletePromotionUseCase.spec.ts` (adicionar)
- `[NEW]` Deve lançar NotFoundException quando promotionId não existe
- `[NEW]` Deve remover apenas a promoção alvo, mantendo as demais
- `[NEW]` Deve registrar auditoria PROMOTION_DELETED

##### `ConfigureWhatsAppUseCase.spec.ts` (adicionar)
- `[NEW]` Deve registrar auditoria WHATSAPP_CONFIGURED
- `[NEW]` Deve usar provider default BUBBLEWHATS quando não informado

##### `ConfigureAIUseCase.spec.ts` (adicionar)
- `[NEW]` Deve usar defaults de language, maxTokens, confidenceThreshold
- `[NEW]` Deve registrar auditoria AI_CONFIG_UPDATED

##### `ConfigureInstagramUseCase.spec.ts` (adicionar)
- `[NEW]` Deve lançar ValidationErrorException quando META_ACCESS_TOKEN não configurado
- `[NEW]` Deve registrar auditoria INSTAGRAM_CONFIGURED

---

### FASE 3 — Testes Unitários de Services/Handlers (Priority: 🟡 HIGH)

##### `TenantAuditService.spec.ts`
- `[NEW]` Deve chamar repository.record() com input correto
- `[NEW]` Deve capturar erro silenciosamente e logar warning
- `[NEW]` Não deve propagar exceção do repository

##### `TenantSubscriptionStatusHandler.spec.ts`
- `[NEW]` Deve se inscrever em 'payment.confirmed' e 'payment.overdue'
- `[NEW]` Deve chamar UpdateTenantPlanStatusUseCase com status ACTIVE no payment.confirmed
- `[NEW]` Deve chamar UpdateTenantPlanStatusUseCase com status EXPIRED no payment.overdue
- `[NEW]` Deve ignorar evento sem tenantId
- `[NEW]` Deve logar erro sem propagar quando use case falha

##### `TrialPaymentConfirmedHandler.spec.ts`
- `[NEW]` Deve se inscrever em 'payment.trial-confirmed'
- `[NEW]` Deve chamar OnboardTrialTenantUseCase com payload correto
- `[NEW]` Deve logar erro sem propagar quando onboarding falha

---

### FASE 4 — Testes E2E (Priority: 🟢 MEDIUM)

##### `tenant-branches.e2e-spec.ts` (NEW)
- `[NEW]` POST /tenants/:id/branches — criar branch com sucesso (201)
- `[NEW]` PUT /tenants/:id/branches/:branchId — atualizar branch com sucesso (200)
- `[NEW]` DELETE /tenants/:id/branches/:branchId — deletar branch com sucesso (200)
- `[NEW]` Deve rejeitar criação de branch sem autenticação (401)
- `[NEW]` Deve rejeitar criação de branch por MEMBER (403)
- `[NEW]` Settings deve listar branches criadas

##### `tenant-settings-full.e2e-spec.ts` (NEW)
- `[NEW]` GET /tenants/:id/settings deve retornar todas as seções (support, channels, company, owner, address, branches, auditLogs, operatingHours, aiConfig, promotions)
- `[NEW]` auditLogs devem refletir ações recentes
- `[NEW]` channels.whatsapp / instagram devem refletir estado correto

##### `tenant-whatsapp-connection.e2e-spec.ts` (NEW - se Twilio configurado)
- `[NEW]` GET /tenants/:id/whatsapp-connection deve retornar embedded signup info

##### `tenant-promotions-full.e2e-spec.ts` (NEW)
- `[NEW]` CRUD completo de promoções (add, update, delete)
- `[NEW]` Verificar persistência após update
- `[NEW]` Verificar que delete remove apenas a promoção alvo
- `[NEW]` Validação: title obrigatório, description obrigatória

---

## Contagem Total Proposta

| Tipo | Existentes | Novos | Total |
|---|---|---|---|
| **Unit — Value Objects** | 0 | ~40 | 40 |
| **Unit — Entities** | 0 | ~55 | 55 |
| **Unit — Use Cases** | ~20 | ~45 | 65 |
| **Unit — Services/Handlers** | 2 | ~12 | 14 |
| **Integration (Prisma)** | 2 | 0 | 2 |
| **E2E (Controller)** | 5 | ~15 | 20 |
| **TOTAL** | ~29 | **~167** | **~196** |

---

## User Review Required

> [!IMPORTANT]
> **Ordem de execução**: Proponho implementar na ordem: Fase 1 (domínio) → Fase 2 (use cases) → Fase 3 (services/handlers) → Fase 4 (E2E). Domínio primeiro porque é a base de tudo. Confirma essa priorização?

> [!IMPORTANT]
> **Testes E2E com Twilio**: Os cenários de Twilio (register sender, verify, refresh) exigem mock do `TwilioManagementAcl`. Devemos criar E2E com override desse provider ou apenas cobrir unitariamente?

> [!IMPORTANT]
> **Granularidade**: Cada bloco (ex: todos VOs, todos Entities) pode ser implementado como um arquivo `.spec.ts` por artefato de domínio ou como suítes agrupadas. Qual preferência?

## Verification Plan

### Automated Tests
```bash
# Rodar todos os testes unitários do módulo tenant
npx jest --testPathPattern="src/modules/tenant/__tests__" --verbose

# Rodar apenas os novos testes de domínio
npx jest --testPathPattern="src/modules/tenant/__tests__/(Tenant|User|TenantBranch|AIConfig|WhatsAppConfig|InstagramConfig|CNPJ|CompanyName|Email|Phone|Plan|Promotion|Address).spec.ts"

# Rodar E2E
npx jest --testPathPattern="src/modules/tenant/__tests__/.*e2e-spec" --runInBand
```

### Manual Verification
- Verificar que nenhum teste existente quebrou
- Validar que testes de domínio capturam regressões reais (ex: comentar uma validação e ver o teste falhar)
