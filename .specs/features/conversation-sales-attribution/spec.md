# Spec — Atribuição de vendas por conversa + comissões e metas

## Contexto

Empresas que **não** operam no fluxo **checkout/commerce assistido pela IA** (cobrança, agendamento, prospecção, atendimento humano, etc.) precisam **registrar vendas manualmente na conversa**, associadas ao **atendente (usuário do tenant)**. Isso alimenta:

- Métricas de vendas **por usuário**
- Base para **comissionamento interno** (percentual fixo base + overrides por usuário + metas)

## Metadados

| Campo | Valor |
|-------|--------|
| IDs prefixo | `ATT-SALES-*`, `COMM-*`, `UI-*` |
| API | Nest (`src/api`) — messaging, sales, tenant/users |
| App | React (`src/app`) — inbox/conversa + equipa/usuários |
| Prioridade MVP | P0 atribuição + API métricas; P1 políticas comissão/metas + UI admin |

## Atores

| Ator | Descrição |
|------|-----------|
| Agente | Inicia marcação de venda na conversa; sujeito à confirmação por IA (**ATT-SALES-007**). |
| OWNER / ADMIN | Configura política de comissão, overrides por utilizador e metas (**sem** envolvimento de platform-admin). Pode rever/aprovar conforme RBAC definida nos guards. |

> **Decisão:** Configuração financeira só **OWNER/ADMIN do tenant** — não é feature de super-admin da plataforma. Ver [`context.md`](context.md).

## Requisitos funcionais

### Atribuição na conversa

| ID | Prioridade | Requisito | Critério “Done when” |
|----|------------|-----------|----------------------|
| ATT-SALES-001 | P0 | Permitir marcar uma conversa como **venda realizada**, quando o tenant **não** está no modo checkout/commerce automatizado de carrinho (ver exclusão em ATT-SALES-010). | Endpoint + persistência; estado devolvido ao frontend na conversa. |
| ATT-SALES-002 | P0 | Associar a venda ao **usuário responsável** (`userId` do tenant — agente/admin que efetuou o registo ou seleccionado explicitamente). | Campo obrigatório na marcação; auditável (`markedBy`). |
| ATT-SALES-003 | P1 | Permitir **valor monetário opcional** da venda (para métricas de receita atribuída e comissão sobre valor). | Nullable decimal validado ≥ 0. |
| ATT-SALES-004 | P1 | Permitir **notas / referência externa** opcional (pedido, contrato). | Campo texto/json limitado persistido. |
| ATT-SALES-005 | P1 | Permitir **corrigir ou remover** marcação (com permissão); histórico ou `updatedAt` visível para relatórios. | PATCH/clear documentado; não duplicar vendas fantasmas sem regra clara. |
| ATT-SALES-006 | P2 | Lista/dashboard **contagem de vendas por usuário** no período (dia/semana/mês). | Endpoint ou agregação consultável por OWNER/ADMIN. |
| ATT-SALES-007 | P0 | Antes de gravar venda, a **IA analisa o contexto** da conversa (mensagens relevantes) e **confirma ou recusa** o pedido do agente; persistir evidência mínima (`ai_confirmed_at`, score/confiança ou texto curto em `metadata`). | Pipeline síncrono ou job curto documentado; falha IA → erro legível ao utilizador. |
| ATT-SALES-008 | P1 | Evento de venda só conta para métricas/comissão quando estado **confirmado pela IA** (ou política explícita de bypass só para OWNER — opcional, deferível). | Campo `status` ou equivalente na entidade de evento. |

### Políticas de comissão e metas

| ID | Prioridade | Requisito | Critério “Done when” |
|----|------------|-----------|----------------------|
| COMM-001 | P1 | **Política base** por tenant: **percentual** sobre valor da venda **e** **valor fixo** por venda (ambos configuráveis; ver regra de combinação em [`context.md`](context.md)). | Defaults persistidos; documentar fórmula no código. |
| COMM-002 | P1 | **Override por usuário**: percentual ou valor diferente da base (opcional). | CRUD ou PATCH por `userId` no âmbito do tenant. |
| COMM-003 | P1 | **Meta de vendas** por usuário: número de vendas e/ou valor no período (mensal recomendado no MVP). | Armazenado e comparável com ATT-SALES agregados. |
| COMM-004 | P2 | Cálculo **derivado** de “comissão estimada” por período (read-only) para relatório interno — sem obrigar pagamentos externos no MVP. | Endpoint ou export CSV opcional; documentar fórmula. |

### UI — Frontend

| ID | Prioridade | Requisito | Critério “Done when” |
|----|------------|-----------|----------------------|
| UI-001 | P0 | Na **vista de conversa/inbox**, acção “Marcar como venda” (condicionada a ATT-SALES-010). | Fluxo feliz + erro tratado (toast). |
| UI-002 | P1 | Modal ou painel na **gestão de utilizadores/equipa** para configurar **comissão base do tenant**, **override por usuário** e **meta**. | Persistência via API; apenas **OWNER/ADMIN**. |
| UI-003 | P2 | Indicador visual na lista de conversas quando já marcada como venda (badge). | |

### Regras de exclusão / modularidade

| ID | Prioridade | Requisito | Critério “Done when” |
|----|------------|-----------|----------------------|
| ATT-SALES-010 | P0 | **Não** oferecer marcação manual quando o tenant/nicho+módulos indicam fluxo **checkout/commerce** (vendas já cobertas pelo módulo adequado). Usar **`Tenant.business_type` + `BusinessNiche` / `NicheModule` + `SubscriptionModule`** conforme [`design.md`](design.md). | Helper único testável; mesmo critério no backend e no frontend (hide/disable UI). |

## Fora do MVP (deferido)

- Integração folha de pagamento / payout automático.
- Multi-moeda complexa além da moeda do tenant.
- Comissões escalonadas por faixa (tiered) — apenas mencionar em roadmap se produto pedir.

## Rastreabilidade código existente

- `messaging_schema.Conversation` — hoje sem `assignedUserId` nem campos de venda ([schema](../../../src/api/prisma/schema.prisma)).
- `sales_schema.SalesMetric` — agregados **diários por tenant**, não por usuário ([SalesMetric](../../../src/api/prisma/schema.prisma)).
- Domínio `Conversation` — status `ACTIVE \| ARCHIVED \| PENDING_HUMAN` ([Conversation.ts](../../../src/api/modules/messaging/domain/entities/Conversation.ts)).
- Nichos/módulos: `billing_schema.business_niches`, `niche_modules`, `subscription_modules`; tenant: `business_type` ([schema](../../../src/api/prisma/schema.prisma)).

## Verificação global

- Testes e2e ou unitários nos use cases críticos (marcação + permissão + exclusão checkout).
- Documentação breve em `IMPLEMENTATION-GAP` ou README do módulo messaging/sales quando implementado.
