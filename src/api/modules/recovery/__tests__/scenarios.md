# Análise e Bateria de Testes — Módulo Recovery (Cobranças e Resgates)

Análise detalhada do módulo final prioritário, `recovery`. Este módulo lida com a recuperação de crédito e cobrança (inadimplência), contendo fluxos críticos como envio de links de pagamento Asaas automáticos para inadimplentes e geradores pautados por IA para negociações (`AIRecoveryGuidanceGenerator`). 

A arquitetura usa o padrão Transaction Script, operando no `IRecoveryRepository` sem entidades complexas de DDD puras, mas com geradores e Handlers fortes de AI.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports/Policies)** | `IRecoveryRepository` (Porta de saída), `RecoveryReplyPolicy` (Regra que julga se uma mensagem do devedor indica promessa de pagamento, ignorar, disputa, etc). |
| **Domain (Generators/IA)** | `AIRecoveryGuidanceGenerator`, `AIRecoveryOutreachGenerator` (Geradores de texto para cobranças delicadas integrados no IA Engine). |
| **Application Services** | `RecoveryCaseMessagingService` (Ponte isolada que joga mensagens de cobrança para a Fila do Módulo Messaging sem acoplamento forte). |
| **Use Cases (9)** | `CreateRecoveryCase`, `GenerateRecoveryPaymentLink`, `SendRecovery...`, `RegenerateRecovery...`, `TriggerRecoveryOutreach`, entre outros. |
| **Handlers** | `RecoveryMessageReceivedHandler` (Escuta o Event Bus global. Se a pessoa responder o bot, intercepta para aplicar a Reply Policy e classificar). |
| **Persistence** | `PrismaRecoveryRepository`. |

---

## Cobertura Atual (9 Arquivos Nativos Excelentes)

O escopo pré-existente possui uma maturidade maravilhosa nos fluxos sensíveis (IA e Transições de Status por Reply):

### ✅ Testes Unitários de IA e Políticas de Interação (Core)
- `AIRecoveryGuidanceGenerator.spec.ts` e `AIRecoveryOutreachGenerator.spec.ts` cobrem toda a injeção do LLM Engine para garantir abordagens personalizadas ao devedor.
- `RecoveryReplyPolicy.spec.ts` e `RecoveryMessageReceivedHandler.spec.ts` estão cobertos, garantindo que "Já paguei" caia na categoria de Disputa e trave novos envios.

### ✅ Testes Unitários de Eventos / Action
- 4 Use Cases complexos (`RegenerateRecovery...`, `RegisterRecovery...`, `SendRecovery...`, `TriggerRecovery...`) estão perfeitamente cobertos testando gatilhos e injeções cruzadas no *MessagingFacade*.

### ✅ Teste E2E (REST)
- `recovery.e2e-spec.ts` blinda 1 fluxo gigante E2E de criação e listagem pelo controller HTTP.

---

## Lacunas Identificadas (Gaps Restantes)

Como foi visto em outros módulos, o time legado priorizou os Casos de Uso pesados de evento e IA, mas deixou os Cadastros Bases desamparados (exigindo apenas do E2E).

### 🔴 Core CRUD Use Cases Desprotegidos
Use Cases essenciais para iniciar o resgate não possuem testes isolados e injetam integrações síncronas que podem falhar sem cobertura:
1. **`CreateRecoveryCaseUseCase`**: Acessa o `ContactFacade` de forma síncrona para buscar/complementar dados do lead CRM (`contactFacade.getContactById`). Sem um Unit Test mockando isso, um timeout nesse Facade quebra a criação da cobrança.
2. **`GenerateRecoveryPaymentLinkUseCase`**: Invoca internamente o `PaymentService` para gerar o link (Pix/Boleto). Não testa falha de serviço ou payload inconsistente (`amountDue` ausente estourando erro de UI localmente).
3. **`Get...`, `List...`, `Update...`**: Rotinas de update e queries desassistidas na camada Application.

### 🔴 Facades Injetados / Service Adapter
A classe `RecoveryCaseMessagingService`, responsável por pegar o caso e transformar num item enfileirado para o WhatsApp Bot (`messagingFacade.queueSystemMessage`), não dispõe de testes. Esse arquivo dita se o devedor precisa ter o contato criado (`ensureContact`) de uma vez, mas não tem Mock Test.

### 🟡 Repositório Prisma (Missing Integration)
Não existe `PrismaRecoveryRepository.integration.spec.ts`.

---

## Proposta de Bateria Completa (Complementar)

Complemento cirúrgico para amarrar 100% da caixa deste módulo:

### FASE 1 — Adaptação e Messaging ByPass Protections (Priority: 🔴 CRITICAL)

##### `RecoveryCaseMessagingService.spec.ts` (NEW)
- Mockar `IContactFacade` e `IMessagingFacade`.
- Simular cenário 1 onde `recoveryCase.contactId` existe -> garante que só acessou `.getContactById` e enfileirou.
- Simular cenário 2 onde não tem Id -> garante uso do `.ensureContact` do CRM primeiro e repassa corretamente `createdContact.contactId`.

### FASE 2 — Core Action Use Cases (Priority: 🔴 HIGH)

##### `CreateRecoveryCaseUseCase.spec.ts` (NEW)
- Impedimentos de regra pura de Domain (`ValidationErrorException`): não permitir passar sem nenhum `debtorName/phone`.
- Simular busca válida e repasse limpo pro Repositório de Mock.

##### `GenerateRecoveryPaymentLinkUseCase.spec.ts` (NEW)
- Lança erro de Validação isolada se o case não possuir `amountDue` (antes de ir pro Gateway PaymentService).
- Validar se repassa URL via message QUEUE após a integração gerar o ID do Boleto/Pix.

### FASE 3 — Leitura CRUD & Prisma Gateway (Priority: 🟡 MEDIUM)

##### Unit Tests Residuais (NEW)
- `GetRecoveryCaseUseCase.spec.ts`, `ListRecoveryCasesUseCase.spec.ts` e `UpdateRecoveryCaseStatusUseCase.spec.ts` mockando e atestando os limites/retornos de API.

##### `PrismaRecoveryRepository.integration.spec.ts` (NEW)
- `[NEW]` Validar persistência via Integração garantindo salvamento em DB e `hasPaymentReference` checks.

---

## Quadro Comparativo Estimado

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **IA / Handlers / Domain** | 4 | 0 | 4 |
| **Unit — Action UseCases (IA/Sender)** | 4 | 0 | 4 |
| **Unit — CRUD UseCases (Faltantes)**| **0** | **~5** | **5** |
| **Unit — Services / ByPass**| **0** | **~1** | **1** |
| **Integration (Prisma)** | 0 | ~1 | 1 |
| **E2E (Adapters & Rest)** | 1 | 0 | 1 |
| **TOTAL** | **~9** | **~7** | **~16** |

---

## User Review Required

> [!NOTE]
> Essa bateria complementar de 7 resgardes finos amarra o `recovery` impecavelmente (sem precisar tocar em LLMs que já têm cobertura blindada legada). E com este estudo, temos o quadro completo do ecossistema inteiro de produtos (**tenant, billing, commerce, catalog, contact, inventory, payment, prospecting e recovery**).
> Todos os planos estão gravados e salvos num roadmap seguro. 
> Daqui para frente estamos na Fase de *Execução massiva*. Confirma encerramento do Discovery? Quer que eu abra uma PR ou execute localmente o Build CI inicial do módulo `Tenant` (Primeiro da Fila)? Como prefere coordenar a entrega do código final?

## Verification Plan

### Automated Tests
Rodaremos a bateria completa validando o repositório E os Facades:
```bash
npx jest --testPathPattern="src/modules/recovery" --verbose
```
