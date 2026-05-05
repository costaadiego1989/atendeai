# Análise e Bateria de Testes — Módulo Commerce (Checkout)

Análise completa do fluxo, cobertura atual e proposta de testes para o módulo `commerce`. Este módulo apresenta uma arquitetura voltada a "Transaction Scripts" (ricos Use Cases operando sobre interfaces de dados), sem a presença de Entidades Ricas (Aggregate Roots) puras no diretório de `domain`. 

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Data Structures / Interfaces)** | Estruturas de Sessão (`CommerceSessionRecord`, `CommerceSessionItemRecord`), Pedido (`CommerceOrderRecord`), Política de Frete (`CommerceShippingPolicyRecord`) e Toques de Abandono (`CommerceAbandonmentTouchRecord`). |
| **Domain Errors** | `InvalidSessionStateError`, `OrderNotFoundError`, `ShippingPolicyNotFoundError`, `ShoppingSessionNotFoundError` |
| **Integration Events** | 10 eventos (Started, ItemAdded, CheckoutCreated, OrderPaid, Preparing, Shipped, ReadyForPickup, Delivered, Cancelled, Abandoned). |
| **Repository Interface** | `ICommerceRepository` (interface muito ampla: 18 métodos de transação e queries ricas). |
| **Use Cases (15)** | `StartShoppingSession`, `AddItemToShoppingSession`, `CheckoutShoppingSession`, `UpdateShoppingSessionFulfillment`, `DetectAbandonedShoppingSessions`, `TriggerCommerceAbandonmentTouch`, `UpdateCommerceAbandonmentState`, `UpdateCommerceOrderStatus`, `SearchCommerceCatalog`, `AdvanceCommerceConversation`, `ConfigureShippingPolicy`, `GetCommerceOrderDetails`, `GetShippingPolicy`, `GetShoppingSession`, `ListCommerceOrders`. |
| **Handlers / Services** | `CommercePaymentEventHandler` (confirmação asaas/pix). Serviços de Máquina de Estado de Conversação (8 `StepHandlers` + `CommerceConversationFlowRules` + `CommerceConversationSearchService`). |
| **Controllers** | `CommerceController` (11 endpoints HTTP). |
| **Persistence** | `PrismaCommerceRepository` (persistência pesada no Postgres). |

---

## Cobertura Atual (6 arquivos de teste)

### 🔴 Testes Unitários de Use Cases Críticos (Zero Cobertura)
A grande maioria da lógica financeira e conversacional *NÃO* possui testes unitários isolados:
- `StartShoppingSessionUseCase` ❌ Nenhum teste isolado.
- `AddItemToShoppingSessionUseCase` ❌ Nenhum teste isolado (lógica crítica complexa de catálogo vs estoque).
- `CheckoutShoppingSessionUseCase` ❌ Nenhum teste isolado (responsável por criar link no Asaas e consolidar o pedido).
- `SearchCommerceCatalogUseCase` ❌ Nenhum teste isolado.
- `AdvanceCommerceConversationUseCase` ❌ Nenhum teste isolado.
- `UpdateShoppingSessionFulfillmentUseCase` ❌ Nenhum teste isolado (calculadora de frete FIXED/PER_KM).
- `ConfigureShippingPolicyUseCase` ❌ Nenhum teste isolado.

### ✅ Testes Unitários Baseados em Eventos (4 UCs testados)
| Arquivo | Cenários | Status |
|---|---|---|
| `UpdateCommerceOrderStatusUseCase.spec.ts` | Validação de transições de status válidas/inválidas e disparo de eventos. | ✅ Bom |
| `DetectAbandonedShoppingSessionsUseCase.spec.ts` | Busca e dispara toques automáticos de reengajamento 1h/1d/7d. | ✅ Bom |
| `TriggerCommerceAbandonmentTouchUseCase.spec.ts` | Disparo manual de toque no lead. | ✅ Básico |
| `UpdateCommerceAbandonmentStateUseCase.spec.ts` | Pausa envios de mensagens de carrinho abandonado. | ✅ Básico |

### ✅ Testes de Event Handlers (1)
| Arquivo | Cenários | Status |
|---|---|---|
| `CommercePaymentEventHandler.spec.ts` | Reação a `payment.confirmed`, atualização do banco para `PAID` e trigger de `CommerceOrderPaidIntegrationEvent`. | ✅ Bom |

### 🟡 Testes E2E (1 gigante)
| Arquivo | Cenários | Status |
|---|---|---|
| `commerce.e2e-spec.ts` | 4 mega cenários que simulam percursos enormes: (1) Setup completo com asaas checkout via fluxo web; (2) CRUD policy; (3) Frete dinâmico com carrinho múltiplo; (4) Fluxo completo _Conversacional_ como máquina de estados. | 🟡 Cobre integrações, mas sem robustez para edge-cases. Muito demorados (~15 segundos para rodar). |

---

## Lacunas Identificadas (Gaps)

### 🔴 Core Transacional Financeiro (Sem isolamento)
1. **Carrinho e Identidade do Item (`AddItemToShoppingSessionUseCase`):** Sem testes garantindo que quantidade negativa lança erro; que item inexistente falha; cálculo incorreto de subtotal.
2. **Setup de Checkout (`CheckoutShoppingSessionUseCase`):** Não testa tentativa de checkout de sessão vazia, tentativa de checkout já pago, geração errônea de valores de frete, link fails.
3. **Frete e Endereço (`UpdateShoppingSessionFulfillmentUseCase`):** Sem testes para distância negativa em cobrança de fret por Km; tentativa de delivery sem payload da distância; pickup sem remoção da taxa de frete.
4. **Política de Frete (`ConfigureShippingPolicyUseCase`):** Regras básicas como frete `< 0` sendo validado não constam.

### 🔴 Core Conversacional NLP / IA de prateleira (Sem testes unitários)
1. **`CommerceConversationFlowRules` / `SearchCommerceCatalogUseCase`**: Como lidam quando a query do usuário cai em dois produtos parecidos? Como o catálogo é mesclado com o inventário priorizando IDs corretos?
2. **`AdvanceCommerceConversationUseCase`**: Sem validação de roteamento (se session status == IDENTIFYING_NEED vai pro IdentifiyingNeedHandler); Sem verificação se a máquina não regride status indevidamente.
3. **Step Handlers (`AwaitingQuantityStepHandler`, etc)**: Cada mini-arquivo desse injeta lógica de parse da resposta do usuário. Ex: E se em "Quantity" o usuário digitar "dois pacotes", funciona?

### 🔴 Event Handlers (Edge Cases Ausentes)
- E se o webhook do payment gateway mandar 2x o payload de confirmação garantindo idempotência? O e2e testa, mas o arquivo de unit handler atual falha em validar esse skip isoladamente.

### 🟡 Repository (Sem Teste de Integração Prisma)
- Ao contrário dos módulos de Tenant e Billing, a persistência do Commerce que possui o mapeamento SQL bruto gigante e Prisma não tem `PrismaCommerceRepository.integration.spec.ts`. O módulo repousa na sorte do E2E gigantesco para não arrebentar queries.

---

## Proposta de Bateria de Testes

### FASE 1 — Testes Unitários dos Core UseCases (Priority: 🔴 CRITICAL)

##### `AddItemToShoppingSessionUseCase.spec.ts` (NEW)
- `[NEW]` Lança excepton se falhar sem inventoryId ou catalogId.
- `[NEW]` Verifica que `quantity <= 0` é rejeitado.
- `[NEW]` Session Not Found falha.
- `[NEW]` Inventory Item não disponível falha com ConflictException.
- `[NEW]` Catálogo não encontrado dá NotFound.
- `[NEW]` Preço nulo lança exceção.
- `[NEW]` Fluxo feliz INVENTORY soma o total, atualiza `subtotal` da Session e lança `CommerceSessionItemAddedIntegrationEvent`.

##### `UpdateShoppingSessionFulfillmentUseCase.spec.ts` (NEW)
- `[NEW]` Para `PICKUP`, garante que zera fretes anteriores, muda o Address para null e total = subtotal.
- `[NEW]` Para `DELIVERY`, lança Conflict se a política estiver inativa.
- `[NEW]` Para `DELIVERY`, lança BadRequest se falhar validando o `deliveryAddress`.
- `[NEW]` Para `DELIVERY` com `PER_KM`, falhar sem `distanceKm`.
- `[NEW]` Para `DELIVERY`, validar que `totalAmount` vira `subtotal + fret`.

##### `CheckoutShoppingSessionUseCase.spec.ts` (NEW)
- `[NEW]` Falhar com lista vazia `[]` de itens.
- `[NEW]` Falhar se `fulfillmentType` for falsy.
- `[NEW]` Falhar se for `DELIVERY` e não tiver location address trim.
- `[NEW]` Falhar se status da sessão for `PAID`.
- `[NEW]` Criar link de pagamento com o PaymentGateway passando metadata de commerce.
- `[NEW]` Salvar OrderRecord garantinho Subtotal / Frete e Status corretos via ICommerceRepository.
- `[NEW]` Disparar `CommerceCheckoutCreatedIntegrationEvent`.

##### `SearchCommerceCatalogUseCase.spec.ts` (NEW)
- `[NEW]` Realizar merge correto removendo duplicatas onde CatalogId == CatalogId já presente nas opções de Inventory.
- `[NEW]` Respeitar o limite inserido e clamp (min 1 max 10).

### FASE 2 — Testes dos Componentes Conversacionais (Priority: 🟡 HIGH)

##### `AdvanceCommerceConversationUseCase.spec.ts` (NEW)
- `[NEW]` Retornar nulo instantaneamente se não for transacional (`businessType`).
- `[NEW]` Rotear para startShopping e Selecting Item step se session não existe e encontra matches.
- `[NEW]` Retornar null caso não encontre match inicialmente e seja null na base.
- `[NEW]` Chamar O Step Handler correto via mock switch-case para evitar dependência cascata.

##### StepHandlers (Mocking `ICommerceRepository`) - (NEW Unit Tests)
- `[NEW]` `AwaitingQuantityStepHandler.spec.ts`: Testar parse numérico se usuário enviar `3`, testar transição de rollback caso não ache a intenção.
- `[NEW]` `ReadyForCheckoutStepHandler.spec.ts`: Garantir que transiciona para criação de payment link se usuário concordar, etc.

### FASE 3 — Processos Complementares & Queries (Priority: 🟡 HIGH)

##### Testes Simples CRUD Resolvers (NEW)
- `[NEW]` `ConfigureShippingPolicyUseCase.spec.ts`
- `[NEW]` `GetCommerceOrderDetailsUseCase.spec.ts`
- `[NEW]` `GetShippingPolicyUseCase.spec.ts`
- `[NEW]` `GetShoppingSessionUseCase.spec.ts`
- `[NEW]` `ListCommerceOrdersUseCase.spec.ts`

### FASE 4 — Integração Especializada (Priority: 🟢 MEDIUM)

##### `PrismaCommerceRepository.integration.spec.ts` (NEW)
- Testar métodos vitais: `createSession`, `addSessionItem`, `upsertShippingPolicy`, `createOrder`, `listOrders`.

---

## Quadro Comparativo Sugerido

| Tipo | Existentes | Novos | Total |
|---|---|---|---|
| **Unit — Errors** | 0 | ~4 | 4 |
| **Unit — Core Use Cases** | 0 | ~35 | 35 |
| **Unit — Complementary UCs** | 4 | ~15 | 19 |
| **Unit — Conversation Flow** | 0 | ~30 | 30 |
| **Unit — Handlers** | 1 | ~3 | 4 |
| **Integration (Prisma)** | 0 | ~8 | 8 |
| **E2E (Controllers)** | 1 (File) | 0 | 1 |
| **TOTAL** | **~6** | **~95** | **~101** |

---

## User Review Required

> [!IMPORTANT]
> O motor **Conversacional do carrinho (AdvanceCommerceConversationUseCase e StepHandlers)** é altamente volátil (processa strings puras convertendo em estados). Apesar da arquitetura estar modular, a ausência total de validação pode quebrar tudo com uma edição descuidada de string-matching em NLP. Posso incluir um set detalhado (30 cenários) cobrindo simulações locais desses prompts/strings contra os Step Handlers?

> [!IMPORTANT]
> **Abismo de Integração Base vs Domain**: Como o negócio inteiro foi fundado no Repository retornando interfaces "Record" cruas ao invés de Entidades Ricas (comportamento de Aggregate Roots), o repositório é fortemente acoplado. Vou criar um arquivo de teste de Integração de Repositório Forte `PrismaCommerceRepository.integration.spec.ts` limitando a testar CRUDs básicos cruciais de Carrinho para não afetar testabilidade da camada App. Assumo que podemos isolar 100% o Mock do rep na fase 1 e 2. Você aceita essa padronização sem refatorar o Módulo para Domain Driven Design rico antes?

## Verification Plan

### Automated Tests
```bash
# Rodar todos os testes unitários do Módulo Commerce
npx jest --testPathPattern="src/modules/commerce" --verbose

# Rodar os testes conversacionais
npx jest --testPathPattern="src/modules/commerce/application/services/conversation"
```
### Manual Verification
- Testar e simular uma nova compra via WhatsApp (ambiente de staging) para comprovar a robustez transacional de cada etapa.
- Tentar injetar quantidade ou valores quebrados na API `POST /sessions/:id/items` via postman para atestar a barreira de segurança inserida na Fase 1.
