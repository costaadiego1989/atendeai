# Módulo: `sales`

**Caminho:** `src/api/modules/sales`  
**Última análise:** 2026-05-04  
**Papel:** payment links, split charges, promoções/contexto com IA; integrações com **`PaymentService`** / gateway.

## Estado da implementação (revisão 2026-05-04)

- **Observabilidade na criação de links:** `CreatePaymentLinkUseCase` emite **`sales.payment_link.created`** com **`amount_band`** (faixa agregada, sem valor literal em logs) + **`billing_type`** / **`source`**; falhas do gateway → **`sales.payment_link.gateway_create_failed`** com mensagem truncada (HTTP continua encapsulado no adapter Asaas).
- **Remarketing sem máquina PIX/boleto:** após webhook **`PAYMENT_OVERDUE`** e projeção em `sales_schema.payment_links`, para prefixo **`sales-link`** com **`contact_id`**, **`PaymentWebhookSalesProjectionService`** publica **`sales.payment_link.overdue_remarketing`**; **`SalesIntegrationHandlers`** (messaging) envia WhatsApp com texto neutro (sem estados intermediários de PIX/boleto).
- **Catálogo mínimo no link:** `POST /sales/links` aceita opcional **`catalogItemId`**, **`catalogItemSku`**, **`catalogItemName`** (persistência em `payment_links`, sem lookup obrigatório ao módulo catalog).

## Valor ao utilizador / oportunidades

- Fechamento rápido de vendas remotas (“link já pronto”).
- **Melhorias:** remarketing já coberto para overdue + contacto; tracking fino por estado PIX/boleto permanece backlog explícito se produto precisar.
- **Features:** catálogo mínimo por SKU/nome opcional na criação do link.

## Acoplamento / manutenção

- Acoplamento a **payment** (ports/IPaymentGateway shapes) — saudável com interface estável.
- **IA + agent rules + tenant repo** (`SuggestPaymentLinkWithAIUseCase`) — mesmo padrão que messaging/commerce; vigilância aos limites billing.
- **Payment → sales (tipo apenas):** `PaymentWebhookSalesProjectionService` importa evento de integração em `sales` para disparar remarketing após `UPDATE … RETURNING`.

## Logs e traces distribuídos

- **`sales.payment_link.created`** / **`sales.payment_link.gateway_create_failed`** com `tenantId` e bandas de montante.
- Evento de remarketing **`sales.payment_link.overdue_remarketing`** (payload com URLs para WhatsApp outbound).

## KISS / DRY

- Não repetir tratamento HTTP do Asaas fora do `AsaasAdapter` / `PaymentService`; use cases apenas orquestram.
