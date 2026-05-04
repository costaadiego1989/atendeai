# Módulo: `messaging`

**Caminho:** `src/api/modules/messaging`  
**Última análise:** 2026-05-03  
**Papel:** WhatsApp/Instagram gateways, inbox, outbound queue, realtime, handlers de integração (**sales**, **scheduling**, **commerce**).

## Valor ao utilizador / oportunidades

- Canal principal para o cliente final — latência e fiabilidade definem perceção da marca.
- **Melhorias:** painel SLA de provedores (Bubble/Whats, 360, Twilio); retry policies visíveis; templates e opt-out.
- **Features:** omnichannel unread sync; registro único por `conversationId` com vistas por equipa.

## Acoplamento / manutenção (alto mas esperado)

- Importa Contact, Tenant, Auth, **AI**, AgentRules, **Billing**, **Commerce** — “hub”.
- **`SuggestAgentReplyService`** cruza IA + billing (`ICheckQuota`, `IRecordUsage`, `AiTokenBillingPolicy`) + agent rules — forte mas coerente; quotas documentadas no próprio serviço para não regressar comportamento billing.
- **Handlers** ligados a integration events por domínio — manter simetria (scheduling/commerce/sales) para onboarding de novos módulos sem copy-pasta.

## Logs e traces distribuídos

- Webhooks externos: importante **trace propagado ou id de correlacionamento WhatsApp meta** onde possível (`wamid` etc.) em structured logs (sem payloads completos quando sensíveis). **Feito:** `ProcessWebhookUseCase` emite eventos `messaging.webhook.*` com `external_message_id`, `tenant_id` e trace OTEL quando o span HTTP existir.
- Processors outbound: log com `queueJobId`, `tenantId`, `conversationId`. **Feito:** `ProcessOutboundMessageUseCase` inclui esses campos nos eventos `messaging.outbound.*`; `OutboundMessageProcessor` envia `queueJobId` do Bull.

## KISS / DRY

- Adapters WhatsApp bem isolados (`BubbleWhatsAdapter`, etc.) — manter assim; registar novos gateways atrás da mesma abstração (`IMessagingGatewayRegistry`).
