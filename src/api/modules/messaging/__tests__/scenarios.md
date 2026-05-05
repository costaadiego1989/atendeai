# Análise e Bateria de Testes — Módulo Messaging (Hub de Comunicação)

O módulo `messaging` é o gateway de entrada e saída de dados do AtendeAi. Ele gerencia a integração com o WhatsApp (via BubbleWhats), controla o histórico de conversas, garante a idempotência de webhooks e orquestra o transbordo entre IA e humano.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports/Gateways)** | `IMessagingGateway` (Contrato com o provider), `IConversationRepository`. |
| **Use Cases (Outbound)** | `ProcessOutboundMessage`, `SendAIMessage`, `SendHumanMessage`. |
| **Use Cases (Inbound)** | `ProcessWebhook` (Entrada única), `ProcessInboundMessage`. |
| **Logic (ACL/Adapters)** | `BubbleWhatsAdapter` (Tradução de payloads externos), `FollowUpService` (Mensagens de reengajamento). |
| **Infrastructure** | `PrismaMessagingWebhookReceiptStore` (Controle de idempotência), `PrismaConversationRepository`. |

---

## Cobertura Atual (22 Arquivos de Teste — Nível de Produção)

Este módulo é o mais exaustivamente testado do projeto, refletindo sua criticidade.

### ✅ Idempotência e Concorrência
- `messaging-idempotency.e2e-spec.ts` garante que o mesmo `messageId` do WhatsApp não seja processado duas vezes.
- `ProcessWebhookUseCase` é testado com transações Prisma (`PrismaTransactionalEventPublisher`).

### ✅ Parsing de Webhooks e Provedores
- `bubblewhats-webhook-formats.e2e-spec.ts` valida diversos formatos de JSON (texto, imagem, localização).
- `BubbleWhatsAdapter.integration.spec.ts` valida a comunicação real (mockada) com a API externa.

### ✅ Handlers de Eventos
- `AIEscalationRequestedHandler` e `AIResponseGeneratedHandler` ligam o módulo de AI com o Messaging.

---

## Lacunas Identificadas (Gaps)

Embora a cobertura seja alta, a natureza de integrações externas introduz riscos de "falha graciosa":

### 🔴 Resiliência de Saída (Outbound Resilience)
O que acontece se o lojista enviar 100 mensagens simultâneas e o BubbleWhats retornar 429 (Too Many Requests)? Precisamos de testes que validem a captura desse erro e a marcação do status da mensagem como `FAILED` ou `PENDING_RETRY`.

### 🔴 Integridade de Mídias Complexas
Mensagens de áudio (PTT) ou documentos com nomes especiais podem quebrar o `MessagingMapper`. Proponho testes unitários focados apenas nas bordas de parsing de mídias exóticas do WhatsApp.

### 🟡 Lógica de Follow-Up (Inactivity)
O `FollowUpService` decide enviar mensagens após X horas de silêncio. Precisamos de testes de tempo (utilizando `jest.useFakeTimers()`) para garantir que:
1. O follow-up **não** seja enviado se o usuário respondeu.
2. O follow-up **não** seja enviado se a conversa foi fechada por um humano.

---

## Proposta de Bateria de Testes (Complementar)

### FASE 1 — Blindagem de Provedor (Priority: 🔴 CRITICAL)

##### `ProcessOutboundMessageUseCase.resilience.spec.ts` (NEW)
- **Retry Logic**: Simular erro 5xx no Gateway. Validar se o evento de falha é disparado para monitoria.
- **Rate Limit (429)**: Validar se o sistema captura o limite do provider sem travar a fila de mensagens.

### FASE 2 — Timeouts e Reengajamento (Priority: 🔴 HIGH)

##### `FollowUpService.spec.ts` (EXPANDED)
- **Race Condition**: Mensagem do usuário chega exatamente no momento do Follow-up. Garantir que a mensagem do usuário "vença" e cancele o disparador automático.
- **Timezone**: Validar que o follow-up não dispare em horários proibidos (ex: madrugada) se houver regras de negócio para isso.

### FASE 3 — Unitários de Valor (Priority: 🟡 MEDIUM)

##### `ValueObjects.spec.ts` (NEW)
- Validar `PhoneNumber`, `MessageId` e outros VOs do domínio para garantir que IDs inválidos do WhatsApp não entrem no core.

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **Unit — Components/Logic** | 5 | ~4 | 9 |
| **Unit — Use Cases (Core)** | 5 | ~3 | 8 |
| **Integration (Prisma/Redis)** | 3 | 0 | 3 |
| **E2E / Webhook Tests** | 9 | 0 | 9 |
| **TOTAL** | **22** | **~7** | **29** |

---

## User Review Required

> [!IMPORTANT]
> O módulo de Messaging é a peça mais estável, mas também a mais sujeita a variações das APIs externas (WhatsApp). Minha recomendação é focar os novos testes na **resiliência de erro** e **idempotência extrema**. Você gostaria de priorizar algum cenário específico de "Mídia" (ex: processamento de áudio para transcrição) ou focamos na estabilidade dos webhooks?

## Verification Plan

### Automated Tests
```bash
npx jest --testPathPattern="src/modules/messaging" --verbose
```
