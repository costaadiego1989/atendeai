# Análise e Bateria de Testes — Módulo Sales (Vendas e Analytics)

O módulo `sales` é responsável pela geração de links de checkout (integração com Asaas) e rastreamento de métricas de performance (Analytics). Diferente de outros módulos, este já possui uma cobertura razoável, mas com pontos cegos em lógicas financeiras críticas e consultas SQL complexas.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain Entities** | `SalesMetric` (Agregado para métricas diárias), `UniqueEntityID`. |
| **Domain Repositories (Ports)** | `ISalesRepository` (Dividido em `ISalesMetricsRepository` e `ISalesPaymentLinksRepository`). |
| **Use Cases (4)** | `CreatePaymentLink`, `CreateSplitPaymentCharge`, `GetSalesMetrics`, `TrackSalesMetric`. |
| **Application Services** | `SalesPaymentLinkLifecycleService` (Orquestra criação, métricas e eventos de links). |
| **Integration Events** | `SalesPaymentLinkCreatedIntegrationEvent`. |
| **Persistence** | `PrismaSalesRepository` (Usa `$queryRaw` extensivamente para links). |

---

## Cobertura Atual (10 Arquivos de Teste - Bom estado)

O módulo já segue um padrão de testes unitários para a maioria dos Use Cases e integração para o Repositório.

### ✅ Testes Unitários (Use Cases & Entity)
- `CreatePaymentLinkUseCase.spec.ts` e `CreateSplitPaymentChargeUseCase.spec.ts` cobrem os fluxos principais de criação de cobranças.
- `SalesMetric.spec.ts` e `TrackSalesMetricUseCase.spec.ts` validam a lógica de contabilidade de métricas.

### ✅ Testes de Integração e E2E
- `PrismaSalesRepository.integration.spec.ts` valida a persistência básica.
- `sales-controller.e2e-spec.ts` e `sales.e2e-spec.ts` garantem que os endpoints REST estão operacionais.

---

## Lacunas Identificadas (Gaps)

### 🔴 Lógica de Distribuição de Receita (Split Payment)
O `CreateSplitPaymentChargeUseCase` contém regras fixas de comissão (`98%` vs `98.5%` baseadas no valor). Esta é uma lógica financeira crítica que deve ser exaustivamente testada para evitar erros de arredondamento ou cálculos incorretos que impactariam o faturamento da plataforma e dos lojistas.

### 🔴 Consultas SQL Complexas (Raw SQL no Repository)
O `PrismaSalesRepository` utiliza `Prisma.sql` (Raw SQL) para quase todas as operações em `payment_links`. Isso inclui filtros dinâmicos, buscas textuais com `LIKE ESCAPE` e agregações de sumário (`Estimated Revenue`, `Paid Revenue`).
- O teste de integração atual não cobre todas as combinações de filtros (Status, Source, BranchId, Search).
- A agregação de sumário (`summaryRows`) é complexa e pode falhar se a estrutura da tabela mudar ou se houver dados nulos inesperados.

### 🟡 Orquestração de Ciclo de Vida (Lifecycle Service)
O `SalesPaymentLinkLifecycleService` é um serviço de aplicação que orquestra a persistência, o incremento de métricas e a publicação de eventos. Embora testado indiretamente, merece um teste unitário isolado para garantir que o "efeito colateral" (métrica + evento) sempre ocorra.

### 🟡 Validação de Documentos e Perfis Financeiros
A lógica de `ensureFinancialCustomer` dentro do `CreateSplitPaymentChargeUseCase` faz manipulação de strings (Regex para tirar máscara de CPF/CNPJ) e criação de perfis. Cenários de documentos inválidos ou incompletos precisam de mais assertividade.

---

## Proposta de Bateria de Testes (Complementar)

### FASE 1 — Deep Dive Financeiro (Priority: 🔴 CRITICAL)

##### `CreateSplitPaymentChargeUseCase.spec.ts` (EXPANDED)
- Testar limites de comissão (exatamente 100 reais, 99.99 reais, 100.01 reais).
- Validar tratamento de erros do `ContactFacade` e `PaymentService`.
- Garantir que o `MessagingFacade` seja chamado corretamente para o envio do WhatsApp com o link formatado.

### FASE 2 — Blindagem de Consultas SQL (Priority: 🔴 HIGH)

##### `PrismaSalesRepository.integration.spec.ts` (EXPANDED)
- Criar baterias de filtros exaustivos (Combinar status + busca textual + branch).
- Validar a lógica de `summary` (comparar os somatórios de `value` e `paid_revenue` com registros reais inseridos no banco de teste).
- Testar a resiliência do `mapPaymentLink` com dados "sujos" ou nulos.

### FASE 3 — Unitários de Serviços (Priority: 🟡 MEDIUM)

##### `SalesPaymentLinkLifecycleService.spec.ts` (NEW)
- Garantir a cadeia: Save -> Increment Metric -> Publish Event.
- Testar falhas parciais (ex: se o Publish falhar, o Create não deve ser revertido?).

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Domain (Entities)** | 1 | 0 | 1 |
| **Unit — Use Cases / Services** | 4 | ~4 (1 Novo + Expansões) | 8 |
| **Integration (Prisma)** | 1 | ~1 (Expansão Crítica) | 2 |
| **E2E (Controllers)** | 2 | 0 | 2 |
| **TOTAL** | **~8** | **~6** | **~14** |

---

## User Review Required

> [!IMPORTANT]
> A lógica de **Split Payment** no módulo de Sales possui valores de comissão fixos. Eu recomendo criar uma suíte de testes de borda para garantir que valores monetários complexos não resultem em erros de split. Além disso, as consultas Raw SQL no repositório precisam de uma suíte de integração que valide o **Analytics Summary** (Resumo de Vendas), pois ele é o motor que alimenta o dashboard do lojista. Concorda com esse foco?

## Verification Plan

### Automated Tests
Pediremos para rodar a suíte sales com verbosidade:
```bash
npx jest --testPathPattern="src/modules/sales" --verbose
```
