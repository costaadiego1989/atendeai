# Feature: Dashboard Agentic Chat (ReAct Agent with LangGraph)

## Overview

Chat agêntico no dashboard que usa LangGraph com agentes ReAct para responder perguntas do usuário sobre seu negócio em tempo real. O agente tem acesso a ferramentas que consultam métricas, dados financeiros, atendimentos, estoque, agendamentos e status operacional — tudo contextualizado pelo nicho de negócio do tenant.

## Requirements

### REQ-001: Agent Core (LangGraph ReAct)
O sistema deve usar `@langchain/langgraph` com `createReactAgent` para orquestrar um agente que raciocina (Reason) e age (Act) usando tools disponíveis.

**Acceptance Criteria:**
- Agent usa OpenRouter como LLM provider via `ChatOpenAI` com baseURL customizada
- Modelo primário configurável via env (`OPENROUTER_DASHBOARD_MODEL`)
- Fallback para modelo mais barato se primary falhar
- Streaming de resposta token-a-token via SSE
- Timeout configurável por request (default 60s)

### REQ-002: Business Context Injection
O agente deve receber contexto completo do negócio do tenant no system prompt.

**Acceptance Criteria:**
- System prompt inclui: businessType, companyName, services, operatingHours, description, address
- Prompt adaptado por nicho (ecommerce vs clínica vs restaurante vs salão etc.)
- Agente responde em pt-BR por padrão
- Agente nunca revela dados de outros tenants (isolation)
- Context window gerenciado (trunca histórico se exceder limite)

### REQ-003: Tools — Métricas de Vendas/Revenue
Ferramenta que consulta dados financeiros do tenant.

**Acceptance Criteria:**
- Consulta receita por período (hoje, semana, mês, últimos 30 dias, custom range)
- Agrupamento por dia/semana/mês/produto/vendedor
- Retorna: total, ticket médio, quantidade de vendas, comparativo com período anterior
- Dados vêm do módulo sales/billing existente
- Sempre scoped por tenantId

### REQ-004: Tools — Atendimentos e Fila
Ferramenta que consulta status de atendimentos em tempo real.

**Acceptance Criteria:**
- Total de conversas ativas, em fila, aguardando humano
- Tempo médio de resposta (IA e humano)
- Distribuição por canal (WhatsApp, Instagram)
- Atendimentos por agente/funcionário
- Status de handoff pendentes

### REQ-005: Tools — Agendamentos (nicho scheduling)
Ferramenta disponível para nichos com agendamento (clinic, salon, scheduling, gym).

**Acceptance Criteria:**
- Agenda do dia/semana: ocupação, horários vagos
- Comparativo de ocupação (esta semana vs anterior)
- Próximos agendamentos com nome do cliente
- Cancelamentos/no-shows do período

### REQ-006: Tools — Catálogo/Estoque (nicho commerce)
Ferramenta disponível para nichos de comércio (ecommerce, food, retail, supermarket).

**Acceptance Criteria:**
- Produtos mais vendidos no período
- Itens com estoque baixo (threshold configurável)
- Pedidos pendentes/em preparo
- Valor médio do pedido

### REQ-007: Tools — Recovery/Cobrança
Ferramenta para consultar status de recuperação de vendas.

**Acceptance Criteria:**
- Total em aberto vs recuperado no período
- Taxa de conversão das tentativas de recuperação
- Top devedores por valor
- Próximas cobranças programadas

### REQ-008: Tools — Contatos/CRM
Ferramenta para consultar base de contatos.

**Acceptance Criteria:**
- Total de contatos, novos no período
- Distribuição por fase do funil
- Contatos mais engajados (interações recentes)
- Busca por nome/telefone

### REQ-009: Niche-Aware Tool Selection
O agente deve disponibilizar apenas tools relevantes ao nicho do tenant.

**Acceptance Criteria:**
- Restaurante: vendas + catálogo + atendimentos (sem agendamento)
- Clínica/Salão: agendamentos + atendimentos + contatos (sem estoque)
- Ecommerce: vendas + catálogo + estoque + recovery + contatos
- Jurídico: atendimentos + contatos (sem vendas/estoque)
- Genérico: vendas + atendimentos + contatos
- Mapeamento nicho→tools configurável (não hardcoded)

### REQ-010: Conversation Memory
O agente deve manter contexto dentro de uma sessão de chat.

**Acceptance Criteria:**
- Histórico persistido por thread (tenant + userId + conversationId)
- Máximo de N mensagens em contexto (configurable, default 20)
- Nova conversa = novo thread
- Histórico limpo após 24h de inatividade

### REQ-011: Frontend Chat Widget
Widget de chat no dashboard para interação com o agente.

**Acceptance Criteria:**
- Chat flutuante (canto inferior direito) ou panel lateral
- Streaming visual (texto aparece token-a-token)
- Indicador de "pensando" / "consultando dados..."
- Mostra quais tools o agente está usando
- Histórico da conversa atual visível
- Sugestões de perguntas baseadas no nicho
- Responsivo (mobile + desktop)

### REQ-012: Rate Limiting & Quota
Controle de uso para evitar abuso.

**Acceptance Criteria:**
- Limite de mensagens por minuto (configurable, default 10)
- Limite diário por tenant (configurable, default 100)
- Resposta amigável quando quota atingida
- Metrics de uso expostas (para billing futuro)

---

## Business Niches — Tool Matrix

| Nicho | Vendas | Atendimentos | Agendamento | Catálogo/Estoque | Recovery | Contatos |
|-------|--------|--------------|-------------|------------------|----------|----------|
| ECOMMERCE | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| FOOD/BAKERY/CAFETERIA | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| RETAIL/SUPERMARKET | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| CLINIC/HEALTH | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SALON/BEAUTY | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| GYM | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| LEGAL | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| REALESTATE | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| RECOVERY | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| B2B/AGENCY | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| GENERIC/OTHER | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## Non-Functional Requirements

- **NFR-001**: Latência primeira token < 2s (streaming)
- **NFR-002**: Tempo total de resposta < 30s para queries complexas (multi-tool)
- **NFR-003**: Tenant isolation absoluta — tool queries always filter by tenantId via configurable, never user input
- **NFR-004**: Graceful degradation — se tool falhar, agente informa sem crashar
- **NFR-005**: Observabilidade — logs de cada tool call, tempo de execução, modelo usado, tokens consumidos

---

## Out of Scope (v1)

- Voice input/output
- Exportação de relatórios em PDF/Excel (futuro)
- Integração com calendário externo (Google Calendar)
- Alertas proativos do agente (push notifications)
- Multi-language (apenas pt-BR v1)
- Fine-tuning de modelos por tenant
