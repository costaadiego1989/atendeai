# Context — decisões de produto (fechadas)

**Actualizado:** 2026-05-04

## 1. Quem configura comissões e metas?

**Decisão:** Apenas **OWNER** ou **ADMIN do tenant**. **Não** é fluxo para platform super-admin.

- UI comissão/metas: só utilizadores com papel `OWNER | ADMIN`.

## 2. Modelo de comissão no MVP

**Decisão:** **Ambos** disponíveis ao nível da política base e overrides por utilizador:

- **Percentual** sobre `saleAmount` (quando existir valor).
- **Valor fixo** por venda contabilizada.

Regra de cálculo quando ambos definidos (stacking vs melhor entre os dois): definir na implementação documentando em código — **default recomendado:** somar percentual aplicado ao valor **mais** fixo por venda, **ou** permitir tenant escolher “modo” (`STACKED | PERCENT_ONLY | FIXED_ONLY`) em `tenant_sales_commission_defaults` se produto pedir desde já.

## 3. Quem marca venda na conversa?

**Decisão:**

- **AGENT** (e equiv. operacional) pode **iniciar** o fluxo “marcar como venda”.
- A **IA valida o contexto da conversa** antes de persistir como venda válida (ver ATT-SALES-007 na spec): extracção/resumo opcional + confiança; se IA reprovar, não criar evento ou criar estado `PENDING_AI_REVIEW` conforme implementação.

**OWNER/ADMIN** continuam com permissão para configurar políticas; podem também marcar/rever vendas se quiserem dar esse poder na RBAC (explicitar em gates).

## 4. Critério “não é checkout” (ATT-SALES-010)

**Decisão:** Usar os **nichos e módulos já mapeados na API**:

- `billing_schema.business_niches` (`BusinessNiche.code`)
- `billing_schema.niche_modules` (`NicheModule`: `niche_code`, `module_code`, flags `is_primary`, etc.)
- `tenant_schema.Tenant.business_type` alinhado ao `code` do nicho (como hoje no onboarding/settings)
- `billing_schema.subscription_modules` — presença activa do módulo **COMMERCE** (ou código equivalente usado no catálogo `billing_modules`) indica fluxo checkout/commerce onde **não** se deve expor marcação manual **ou** onde esta fica desactivada por política.

Implementação: helper único que cruza **tenant → business_type → niche_modules → subscription_modules activos** para decidir `manualSaleAttributionAllowed`.

## 5. Metas: período e formato

**Decisão (default até nova instrução):**

- Período: **mês civil** (calendário).
- Metas: **ambos opcionais** — meta de **contagem** de vendas e meta de **valor** (`COMM-003`).
