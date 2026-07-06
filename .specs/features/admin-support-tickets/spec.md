# Feature: Admin Support Tickets

## Overview
Página no painel platform-admin para visualizar todos os feedbacks (tickets, bugs, sugestões) de todos os tenants, com capacidade de responder. A resposta chega na caixa de mensagens WhatsApp do usuário que criou o feedback.

## Requirements

### REQ-AST-001: Listar todos os feedbacks (cross-tenant)
O super admin deve ver todos os feedbacks de todos os tenants em uma lista paginada, com filtros por:
- `type` (BUG, SUGGESTION, IMPROVEMENT)
- `status` (OPEN, REVIEWED, CLOSED)
- `tenantId` (opcional)
- Ordenação por `createdAt` desc (mais recentes primeiro)

Cada item mostra: título, tipo, status, nome do usuário, tenant, data de criação.

### REQ-AST-002: Ver detalhes de um feedback
O admin pode clicar em um feedback para ver:
- Título, descrição completa, tipo, status
- Informações do usuário (nome, email)
- Tenant (nome da empresa)
- Página/módulo de origem (`pagePath`, `appModule`)
- Data de criação
- Histórico de replies (se houver)

### REQ-AST-003: Responder a um feedback
O admin pode escrever uma resposta textual. Ao enviar:
1. A resposta é salva no banco (nova tabela `feedback_replies`)
2. A mensagem é enviada via WhatsApp ao usuário que criou o feedback (usando `MessagingFacade.queueSystemMessage`)
3. O status do feedback muda automaticamente para `REVIEWED` (se estava `OPEN`)

### REQ-AST-004: Atualizar status do feedback
O admin pode mudar o status manualmente:
- OPEN → REVIEWED
- REVIEWED → CLOSED
- CLOSED → OPEN (reabrir)

### REQ-AST-005: Página web admin
Nova rota `/admin/support` no web app com:
- Autenticação via API key (input no login ou header persistido)
- Tabela com feedbacks, filtros, paginação
- Modal/drawer de detalhes com formulário de reply
- Indicadores visuais de tipo (badge colorido) e status

### REQ-AST-006: Reply chega na caixa de mensagens
Quando o admin responde, o sistema:
1. Localiza o `userId` do feedback
2. Busca o telefone do usuário (via tenant owner ou user record)
3. Garante que existe um contato no CRM do tenant
4. Envia a mensagem via `queueSystemMessage` com prefixo "[Suporte AtendeAi]"

## Out of Scope
- Notificações push no app mobile
- Upload de anexos/screenshots no reply
- Atribuição de tickets a agentes internos
- SLA/tempo de resposta
- Integração com ferramentas externas (Zendesk, etc.)

## Technical Notes
- Auth: reutilizar `PlatformAdminApiKeyGuard` existente
- Messaging: usar `IMessagingFacade.queueSystemMessage()`
- Prisma: nova tabela `feedback_replies` no `support_schema`
- Frontend: nova rota `/admin/support` no `src/web`
- Padrão existente: `SendTenantManualWhatsAppUseCase` como referência para envio
