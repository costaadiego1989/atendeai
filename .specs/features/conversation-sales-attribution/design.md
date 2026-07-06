# Design — Atribuição de vendas + comissões

## Visão

Introduzir um **registo explícito de venda por conversa** desacoplado do fluxo commerce/checkout, persistido de forma consultável para métricas e comissões. Evitar sobrecarregar `Conversation` com dezenas de campos de negócio: preferir **tabela dedicada** referenciando `conversationId` + `tenantId`.

## Modelo de dados (proposta)

### Nova tabela `sales_schema.conversation_sale_events` (nome final alinhável ao naming existente)

| Coluna | Tipo | Notas |
|--------|------|--------|
| id | UUID PK | |
| tenant_id | UUID | Índice |
| conversation_id | UUID | FK lógica para `messaging_schema.conversations`; sem FK cross-schema se Prisma limitar — usar consistência aplicacional ou view |
| attributed_user_id | UUID | Utilizador tenant (`tenant_schema.users`) |
| sale_amount | Decimal nullable | ATT-SALES-003 |
| currency | opcional | Default tenant/BRL |
| status | ACTIVE \| VOIDED | soft void vs hard delete |
| marked_by_user_id | UUID | Quem registou |
| marked_at | timestamptz | |
| notes | text nullable | ATT-SALES-004 |
| metadata | jsonb opcional | Incluir payload IA: confiança, resumo, modelo, `rejected_reason` |
| ai_validated_at | timestamptz nullable | Preenchido quando ATT-SALES-007 aprova |
| ai_validation_status | PENDING \| APPROVED \| REJECTED | ATT-SALES-007/008 |

**Índices:** `(tenant_id, attributed_user_id, marked_at)`, `(tenant_id, conversation_id)` UNIQUE partial onde `status = ACTIVE` **e** `ai_validation_status = APPROVED` (ajustar se negócio permitir re-tentativa).

### Configuração comissão / metas

**Opção A — campos em `tenant_schema` + tabela perfil:**

- `tenant_sales_commission_defaults` (1:1 tenant): `basePercent`, `baseFixedAmount`, `commission_combine_mode` (`STACKED` \| `PERCENT_ONLY` \| `FIXED_ONLY` — ver `context.md`), `effective_from`.
- `tenant_user_sales_profile`: `user_id`, `tenant_id`, `commission_percent_override`, `commission_fixed_override`, `monthly_sales_count_target`, `monthly_sales_amount_target`, `updated_at`.

**Opção B — JSON em billing/settings** — menos normalizado; não recomendado para relatórios.

Escolha **A** para COMM-001..003.

### Agregações

Curto prazo: queries com `GROUP BY attributed_user_id` + janela temporal.

Médio prazo: job nocturno alimentando `sales_schema` ou estendendo `SalesMetric` com colunas opcionais por user (só se volume exigir).

## API (módulos)

| Módulo | Responsabilidade |
|--------|------------------|
| **messaging** ou **sales** | Use case `MarkConversationSale`, `VoidConversationSale`, `ListUserSalesSummary`. |
| **tenant** | CRUD policies + user sales profile (guard: OWNER/ADMIN). |
| **ai** ou **messaging** | Serviço `ValidateSaleContextAI` — input conversa/mensagens, output approve/reject + metadados (ATT-SALES-007). |
| **billing** | Leitura `BusinessNiche`, `NicheModule`, `SubscriptionModule`, `Tenant.businessType` para ATT-SALES-010. |

REST sugerido (prefixo `/tenants/:tenantId`):

- `POST .../conversations/:conversationId/sale-attribution`
- `PATCH .../conversations/:conversationId/sale-attribution`
- `DELETE .../conversations/:conversationId/sale-attribution` (void)
- `GET .../sales/users/:userId/summary?from=&to=`
- `GET/PATCH .../settings/sales-commission` (defaults)
- `GET/PATCH .../users/:userId/sales-profile`

## Frontend

- **Inbox:** agente submete “Marcar venda” → estado pendente até resposta IA → feedback sucinto (aprovado / recusado + motivo curto).
- **Equipa (`TeamPage`):** entrada “Metas e comissão” → modal (tabs: política base | utilizador); só **OWNER/ADMIN**.

## ATT-SALES-010 — exclusão checkout (nichos na API)

Implementar `tenantSupportsManualSaleAttribution(tenantId)`:

1. Resolver `tenant.business_type` → `BusinessNiche.code` (normalizar casing).
2. Carregar `NicheModule` para esse `niche_code` e lista de `module_code` primários/recomendados associados ao fluxo **commerce/checkout**.
3. Cruzar com `SubscriptionModule` **ACTIVE** do tenant (`tenantId` + `status`).
4. Se módulo COMMERCE (código exacto conforme seeds em `billing_modules`) está activo **e** o nicho o marca como fluxo checkout-only → **desactivar** marcação manual.

Manter nomes de `module_code` num único enum/string centralizado na camada billing para evitar typos.

## ATT-SALES-007 — fluxo IA

- Preferir chamada ao mesmo stack de IA já usado para intents/resumo (facade existente).
- Timeout e fallback: se IA indisponível, não gravar venda APPROVED (erro retry) ou política degradada só para OWNER — **deferir bypass** conforme spec ATT-SALES-008.

## Riscos

- FK cross-schema no Postgres: permitido; Prisma pode exigir relações unsync — validar em POC migration.
- Concorrência: dois agentes marcam ao mesmo tempo — UNIQUE parcial ou transacción serializable no POST.
