# FEATURES - `commerce`

## Estado atual

O modulo cobre sessão de compra, carrinho, cupom, checkout, abandono e fulfillment. Ele e um dos caminhos mais diretos para gerar receita dentro da conversa.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Checkout conversacional guiado | parcial | Cliente final compra sem sair do WhatsApp ou inbox. | Aumento da taxa de carrinho para pagamento iniciado. |
| P0 | Recuperacao de abandono com contexto | parcial | Loja recupera vendas perdidas com mensagens relevantes. | Receita recuperada por abandono atribuida ao modulo. |
| P0 | Fulfillment visivel para atendimento | parcial | Time sabe se pedido foi pago, separado, enviado ou concluido. | Menos perguntas internas sobre status do pedido. |
| P1 | Frete/politica de entrega configuravel | recomendado | Compra fica mais clara antes do pagamento. | Reducao de abandono na etapa de entrega. |
| P2 | Recomendacao de upsell/cross-sell | recomendado | Aumenta ticket medio com sugestoes de itens relacionados. | Aumento de ticket medio em sessoes com recomendacao. |

## Gaps conhecidos (checkout & envio)

| # | Gap | Contexto | Proposta |
|---|-----|----------|----------|
| G1 | Sem integracao com Correios/Melhor Envio | Empresas que enviam por esses metodos nao tem calculo de frete automatico nem geracao de etiqueta. | Criar adapter `IShippingGateway` com implementacoes para Correios (API dos Correios) e Melhor Envio. Calcular frete no checkout quando `shippingMode = 'CARRIER'`. |
| G2 | Tracking code sem identificacao de transportadora | O campo `trackingCode` nao indica se e Correios, Jadlog, Melhor Envio etc. Sem isso, nao da pra gerar o link correto automaticamente. | Adicionar campo `carrier` (enum: `CORREIOS`, `JADLOG`, `MELHOR_ENVIO`, `OTHER`) no DTO e no schema. Gerar `trackingUrl` automaticamente com base no carrier. |
| G3 | Atalho no chat para enviar tracking | Apos preencher o tracking no pedido, o atendente deveria ter um botao/atalho no chat para enviar a info ao cliente. Hoje o envio e automatico via `OrderTrackingNotificationHandler`, mas o user pode querer reenviar manualmente. | Criar quick-action no chat (frontend) que chama `GET /commerce/orders/:id/tracking` e envia mensagem formatada. |
| G4 | Mensagem automatica apos cadastro do tracking | Ja implementado via `OrderTrackingNotificationHandler` — ao setar tracking, o sistema envia automaticamente no WhatsApp. Funciona, mas a mensagem nao diferencia o carrier para incluir o link correto. | Depende de G2 — com carrier identificado, `buildTrackingMessage` gera link especifico (ex: `https://rastreio.correios.com.br/{code}`). |

## Observacao

O modulo deve priorizar fluxo simples e confiavel: escolher, pagar, acompanhar e recuperar abandono.
