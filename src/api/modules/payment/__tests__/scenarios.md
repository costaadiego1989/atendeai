# Análise e Bateria de Testes — Módulo Payment (Gateway e Finanças)

Análise da arquitetura do módulo `payment` e seu framework atual de testes. Este módulo atua focado num paradigma de adaptação contínua (Anti-Corruption Layer) e Gateway agnóstico. Toda sua complexidade está em **enviar payloads para o Gateway (Asaas)** e **receber/validar webhooks externos**.

Sua comunicação interna para o restante da arquitetura acontece via eventos passivos (`Projection Services` disparados por UseCases), contornando as chamadas síncronas para salvar tempo na resposta do webhook do gateway (evitando timeout na provedora ASAAS).

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports)** | `IPaymentGateway` (Contrato gigantesco padronizando PIX, CreditCard, Splits, etc), `ITenantFinancialAccountRepository`. |
| **Domain Entities** | Transacional (Sem entidades ricas isoladas por opção para não poluir os adapters). |
| **Use Cases (4)** | `BootstrapTenantFinancialAccount`, `GetTenantFinancialAccountStatus`, `InitiateTrialSubscription`, `ProcessWebhook`. |
| **Projection Services** | `PaymentWebhookSalesProjectionService`, `PaymentWebhookSchedulingProjectionService`, `TrialPaymentProjectionService` (Core). |
| **Gateway Adapter** | `AsaasAdapter` (Implementa o `IPaymentGateway`). |
| **Background Workers** | `TrialExpirationProcessor` (Garante inativação hard de lojas caloteiras 1x por dia). |
| **Webhooks/Controllers** | Endpoint massivo em `PaymentController`. |
| **Security Guards** | `AsaasWebhookGuard`. |

---

## Cobertura Atual (11 Arquivos de Teste Maduros)

A maior e mais complexa cobertura individual do ecossistema inteiro se encontra aqui (até mais crítica que Contact).

### ✅ Core Testes Unitários de Integração (Adapters e Webhooks)
- `AsaasAdapter.integration.spec.ts` já garante toda a integração com o provedor (parse de payload, formatação de requisições de sub-contas e parcelas).
- `ProcessWebhookUseCase.spec.ts` é uma imensa suíte blindando parsing do recebimento do webhook Asaas, roteamento, e blindagens try/catch evitando erro 500 do Asaas estourar.
- `AsaasWebhookGuard.spec.ts` (Testa validação de IP e chaves do cabeçalho injetado por provedor de pagamento).
- `PaymentService.spec.ts` e `TrialExpirationProcessor.spec.ts` garantem a varredura do worker cron diário de cortar acessos.
- `BootstrapTenantFinancialAccountUseCase.spec.ts` garante os fluxos da criação da subconta e tratativas contra CNPJs duplicados.

### ✅ Testes E2E Rest (2)
- `payment-webhook.e2e-spec.ts` (Teste gigante só para as retentativas de envio webhooks de fraude vs webhooks sadios).
- `payment.e2e-spec.ts` (Teste padrão API).

---

## Lacunas Identificadas (Gaps Críticos Restantes)

A aparente perfeição da cobertura do módulo esconde um grande perigo. Quando os Webhooks são aprovados (`ProcessWebhookUseCase`), eles são injetados de forma síncrona nos **Projection Services**.

### 🔴 Projection Services Silenciosos (Cross-Module Violation Risks)
Existem 3 services (`PaymentWebhookSalesProjectionService`, `PaymentWebhookSchedulingProjectionService`, `TrialPaymentProjectionService`) que NÃO têm nenhum tipo de cobertura de testes.

O perigo deles é imenso pois **eles acessam recursos de outros módulos via bypass**. 
Exemplo 1: O `SalesProjectionService` dispara queries isoladas `LIMITADORAS VIA RAW SQL ($executeRaw)` na base `sales_schema.payment_links` corrompendo intencionalmente a fronteira restritiva de DDD. E se alguém mudar o nome da tabela no Prisma amanhã? Nenhuma query builder (PrismaClient) avisará. Esse SQL irá falhar em tempo real de produção, e links fechados nunca serão confirmados.
Exemplo 2: O `SchedulingProjectionService` manipula strings `JSON.parse` direto da pipeline de chaveamento via injeção `Redis` (bypassando repositórios do Tenant de Agendamento). Mudar o state "PRE_RESERVED" silenciosamente requer testes unitários firmes confirmando a key `slotId`.

### 🟡 Repositórios
As injeções de Prisma básicas como o `IContactFinancialProfileRepository.ts` não têm testes unitários assegurando o `.findByTenantAndContact`.

---

## Proposta de Bateria de Testes Complementares

A base fundamental precisa apenas de um fechamento forte nos Cross-Module Projection Services:

### FASE 1 — Cross-Module ByPass Protections (Priority: 🔴 CRITICAL)

##### `PaymentWebhookSalesProjectionService.spec.ts` (NEW)
- Mockar injeção do Prisma. 
- Disparar um Payload EventType=`PAYMENT_CONFIRMED`.
- Garantir que a Regex de "rawReference" (`/^(sales-link\|sales-charge)\|/`) passe.
- Validar se o spy do `$executeRaw` recebeu de fato os Enums e TenantId exatos para atualizar o table schema `sales_schema.payment_links`.

##### `PaymentWebhookSchedulingProjectionService.spec.ts` (NEW)
- Injetar `ioredis-mock`.
- Criar a chave literal `scheduling:tenant:123:professional:456:availability:xyz` baseando na sintaxe.
- Ao receber payload do ASaaS dizendo `status: PAID`, testar a varredura Redis.
- Garantir que o Redis recebeu `.hset(key, slotId, ...novoJson)` com a transição cravada em `RESERVED` e com as `payment.confirmedAt` dates limpas.

##### `TrialPaymentProjectionService.spec.ts` (NEW)
- A mesma coisa para subscrições de planos Trial, mockando injeções ao repositório de Billing interno (caso modifique tenant states limitadores).

### FASE 2 — Prisma Gateway (Priority: 🟡 MEDIUM)

##### `PrismaPaymentRepositories.integration.spec.ts` (NEW)
- `[NEW]` Validar persistência via Integração do `ITenantFinancialAccountRepository` para salvar as chaves API base de transição (garantindo que tokens de gateway ASaaS com até 255 chars caibam sem erros de DataTruncation).

---

## Quadro Comparativo (Completo)

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **Security Guards / Domain** | 1 | 0 | 1 |
| **Unit — Core Services/Adapters** | 4 | 0 | 4 |
| **Unit — Core Use Cases** | 3 | 0 | 3 |
| **Unit — Projection ByPass** | **0** | **~6** | **6** |
| **Integration (Prisma)** | 0 | ~2 | 2 |
| **E2E (Adapters & Rest)** | 3 | 0 | 3 |
| **TOTAL** | **~11** | **~8** | **~19** |

---

## User Review Required

> [!WARNING]
> Esses "Projection Services" que acessam **Redis Direto (`ioredis` raw commands)** e **Raw SQL Queries (`Prisma.sql` limitante de schema)** violam o encapsulamento dos módulos irmãos (como `scheduling` e `sales`). Isso foi feito por razões óbvias de performance para descarregar payload rápido de Webhook do Asaas, mas sem testes firmes, eles são as primeiras peças a arrebentar se, por exemplo, o módulo de agendamento transicionar pro Postgres ou o de Vendas mudar um tipo do Postgres. Eu sugiro a produção exclusiva desses 8 testes com mocks ultra detalhistas nas SQL/Redis keys. Posso focar apenas nos Projections para o Payment e assim fechar 100% o ciclo transacional e cross-module?

## Verification Plan

### Automated Tests
Execute para rodar somente unitárias na stack crítica:
```bash
npx jest --testPathPattern="src/modules/payment/application/services" --verbose
```
