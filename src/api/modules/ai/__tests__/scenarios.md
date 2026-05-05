# Análise e Bateria de Testes — Módulo AI (Motor Cognitivo)

O módulo `ai` é o cérebro do AtendeAi. Ele não apenas chama o LLM (DeepSeek), mas orquestra o contexto de múltiplos módulos (Commerce, Scheduling), aplica regras de voz de marca (Agent Rules), decide quando transbordar para um humano (Handoff Policy) e garante que o lojista não exceda sua cota (Billing integration).

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports)** | `IAIEngine` (Porta para rotear entre DeepSeek/Claude/OpenAI), `IChatHistoryRepository` (Redis). |
| **Use Cases** | `ProcessAIResponseUseCase` (O grande orquestrador do fluxo de mensagem). |
| **Logic (Services)** | `AIContextAggregator` (Busca dados das APIs de outros módulos), `AIResponseProcessor` (Extrai tags de pagamento/link), `HumanHandoffPolicy`. |
| **Infrastructure** | `DeepSeekAdapter`, `RedisChatHistoryRepository`. |
| **Domain Events** | `AIResponseGenerated`, `AIEscalationRequested`, `AIQuotaDenied`. |

---

## Cobertura Atual (16 Arquivos de Teste — Nível Alto)

O módulo `ai` é um dos mais protegidos do sistema, com uma pirâmide de testes bem definida.

### ✅ Testes Unitários de Componentes
- `PromptBuilder`, `AIResponseProcessor`, e `LeadScoringService` estão cobertos unitariamente.
- `ProcessAIResponseUseCase.spec.ts` (17KB) já faz o "heavy lifting" testando o fluxo de sucesso e persistência no Redis.

### ✅ Provedores de Contexto (Cross-Module Integration)
- `CommerceContextProvider.spec.ts` e `SchedulingContextProvider.spec.ts` garantem que a IA "saiba" o estado da mesa do cliente ou horários do profissional antes de responder.

### ✅ Adapters e Persistência
- `DeepSeekAdapter.integration.spec.ts` isola a camada HTTP com o provedor.
- `RedisChatHistoryRepository.integration.spec.ts` valida o armazenamento volátil das conversas.

---

## Lacunas Identificadas (Gaps)

Apesar da alta cobertura, existem rotas de exceção "silenciosas" que podem quebrar a experiência se não testadas:

### 🔴 Resiliência e Fallback (Priority: 🔴 CRITICAL)
O `handleFailure` no `ProcessAIResponseUseCase` envia uma mensagem de fallback padrão ("Estou com instabilidades..."). Não há testes unitários forçando erros no `DeepSeekAdapter` (ex: 429 Too Many Requests ou 503) para garantir que o sistema não trave o Chat e publique o `AIResponseFailedIntegrationEvent` corretamente para monitoria.

### 🔴 Enforcement de Cotas (Billing Path)
O sistema chama `checkQuotaUseCase.execute` antes de cada processamento. Gaps existentes em testar o retorno `canProceed: false` para garantir que o `AIQuotaDeniedIntegrationEvent` seja disparado e que a IA **NUNCA** seja chamada (evitando gastos desnecessários de tokens em contas bloqueadas).

### 🟡 Prioridade de Regras de Agente (Persona Guard)
A lógica em `applyMessagingAgentRule` decide se o prompt customizado do lojista "soma" ou "sobrepõe" o prompt do sistema. Casos com `fallbackToGlobal: false` são vitais para lojistas que não querem o tom genérico do sistema. Precisamos de testes que validem a string final do Prompt.

### 🟡 Resolução Dinâmica de Filial (BranchId)
A resolução do `branchId` a partir do repositório de contatos quando não enviado no payload não está exaustivamente coberta em cenários onde o contato não existe.

---

## Proposta de Bateria de Testes (Complementar)

### FASE 1 — Resiliência e Quotas (Priority: 🔴 CRITICAL)

##### `ProcessAIResponseUseCase.resilience.spec.ts` (NEW)
- **Cenário Quota Excedida**: Mockar `checkQuotaUseCase` com `.canProceed = false`. Validar que o `aiEngine.generateResponse` **não** foi chamado e o evento de denegação saiu.
- **Cenário API Offline**: Mockar `aiEngine` para lançar `Error('Provider Offline')`. Validar o disparo do evento de falha e o retorno do fallback textual amigável ao usuário.

### FASE 2 — Prompt Integrity (Priority: 🔴 HIGH)

##### `ProcessAIResponseUseCase.prompts.spec.ts` (NEW)
- **Override Test**: Validar que se `fallbackToGlobal: false`, a instrução `[ATENção: ... PRIORIDADE]` está presente no prompt final enviado à IA.
- **Branch Context**: Garantir que o `branchId` correto foi usado para buscar a `AgentRule`.

### FASE 3 — Context Aggregation (Priority: 🟡 MEDIUM)

##### `AIContextAggregator.spec.ts` (EXPANDED)
- Testar agregação quando o profissional do agendamento não possui agenda configurada (evitar prompts nulos ou "undefined").

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **Unit — Components/Logic** | 7 | ~3 | 10 |
| **Unit — Use Cases (Core)** | 1 | ~4 (Edge cases) | 5 |
| **Integration (Redis/Adapters)** | 2 | 0 | 2 |
| **Context Providers** | 3 | 1 | 4 |
| **E2E / Live AI Tests** | 3 | 0 | 3 |
| **TOTAL** | **16** | **~8** | **24** |

---

## User Review Required

> [!IMPORTANT]
> O módulo AI é orquestrado por eventos pesados. Minha recomendação é focar 100% dos novos testes em **resiliência de erro**. O custo de tokens do DeepSeek pode escalar se o `checkQuota` falhar silenciosamente. Você aprova a criação de testes de borda que forçam erros 500 na IA e bloqueios de cota para garantir que o gasto financeiro do lojista seja protegido?

## Verification Plan

### Automated Tests
Rodaremos os specs de IA validando o sistema de cota integrado:
```bash
npx jest --testPathPattern="src/modules/ai" --verbose
```
