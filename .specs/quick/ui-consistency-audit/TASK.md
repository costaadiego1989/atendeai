# UI Consistency Audit — src/app

Data: 2026-05-22  
Módulos varridos: todos em `src/app/src/modules/`

---

## Legenda de prioridade
- 🔴 Alta — visível em múltiplos módulos, causa percepção de despadronização imediata
- 🟡 Média — localizado mas fora do padrão
- 🟢 Baixa — pequeno detalhe, não rompe UX

---

## 1. Inputs / Selects com altura fora do padrão (`h-8 text-xs`)

O design system usa `h-10` (SelectTrigger padrão) e `h-9` para botões `sm`.  
Vários componentes usam `h-8 text-xs` criando densidade visual inconsistente.

| Prioridade | Arquivo | Linhas | Nota |
|---|---|---|---|
| 🔴 | `automations/components/AutomationStepBuilder.tsx` | 71, 99, 116, 129, 143, 153, 227 | SelectTrigger e Inputs todos `h-8 text-xs` |
| 🟡 | `social/components/CreateRuleSheet.tsx` | 150, 205 | SelectTrigger `h-8 text-xs` + Input `h-8` |
| 🟡 | `social/components/SocialSettingsSheet.tsx` | 51 | SelectTrigger `w-[100px] h-8 text-xs` |
| 🟡 | `checkout/components/CheckoutDetailsSheet.tsx` | 189 | Button `h-8 gap-2 rounded-lg text-xs` |
| 🟡 | `checkout/components/ShippingPolicySheet.tsx` | 249, 264 | Buttons `h-8 text-[11px] rounded-lg` |
| 🟡 | `checkout/components/CheckoutOrdersMesa.tsx` | 260 | Button `h-8 justify-center gap-1.5 rounded-md` |

**Correção:** Remover `h-8` — usar altura padrão do componente. Trocar `text-xs` por `text-sm`.

---

## 2. Cores hardcoded `emerald` / `green` (deveriam usar token `success`)

O design system tem `--success: 152 60% 40%` → classes `text-success`, `bg-success`, `border-success`.  
Usos de `emerald-*` e `green-*` quebram dark mode e torna difícil trocar a paleta global.

| Prioridade | Arquivo | Cor usada | Contexto |
|---|---|---|---|
| 🔴 | `automations/components/AutomationsList.tsx:50` | `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400` | Badge status "ativo" |
| 🔴 | `social/components/CreateRuleSheet.tsx:264` | `bg-emerald-500/10 text-emerald-600` + pulsing dot `bg-emerald-500` | Badge "Status Pré-ativo" |
| 🟡 | `checkout/components/CheckoutDetailsSheet.tsx:155` | `border-emerald-500/20 bg-emerald-500/5 text-emerald-400` | Status badge |
| 🟡 | `checkout/views/CheckoutPage.tsx:26,200` | `bg-emerald-500/10 text-emerald-400` + pulsing dot | Status color fn + dot |
| 🟡 | `billing/views/BillingUsagePage.tsx:461,597,603` | `text-emerald-500`, `text-emerald-600` | Economia/desconto |
| 🟡 | `billing/components/PricingComparisonTable.tsx:124,141,149,181,199` | `bg-emerald-500/20 text-emerald-400` | Badges de features inclusas |
| 🟡 | `inventory/components/InventoryConnectionsTab.tsx:71` | `border-green-500/40` | Status conexão ativa |
| 🟡 | `settings/components/VoiceMetricsCards.tsx:51,52` | `text-emerald-600 bg-emerald-100` | Ícone KPI métrica |
| 🟢 | `dashboard/views/DashboardPage.tsx:348` | `text-emerald-400` | CheckCircle ícone |

**Correção:** Substituir `emerald-*`/`green-*` por `success` (token semântico já definido no CSS).  
Ex: `bg-emerald-500/10 text-emerald-600` → `bg-success/10 text-success`

---

## 3. `Dialog` para formulários não-destrutivos (deveria ser `Sheet`)

`AlertDialog` para confirmações destrutivas = correto.  
`Dialog` para formulários/detalhes = fora do padrão — usar `Sheet` lateral.

| Prioridade | Arquivo | Observação |
|---|---|---|
| 🔴 | `messaging/components/ConversationChargeDialog.tsx` | Formulário de cobrança em popup central `sm:max-w-[560px]` |

**Correção:** Converter para `Sheet side="right"`.

---

## 4. Gap inconsistente nos botões de header de página

Padrão observado em 80%+ dos headers: `flex flex-wrap gap-2`.  
Arquivo fora do padrão:

| Prioridade | Arquivo | Gap atual | Padrão |
|---|---|---|---|
| 🟡 | `billing/components/BillingHeader.tsx:40` | `gap-3` | `gap-2` |

**Correção:** `gap-3` → `gap-2` no container de botões do `BillingHeader`.

---

## 5. `VoiceMetricsCards` — ícone container fora do padrão KPI

`KPICard` compartilhado usa `rounded-2xl bg-primary/10 p-3` com `text-primary`.  
`VoiceMetricsCards` tem implementação própria com cores hardcoded.

| Prioridade | Arquivo | Linha | Problema |
|---|---|---|---|
| 🟡 | `settings/components/VoiceMetricsCards.tsx` | 62 | `h-7 w-7 rounded-lg ${card.bgColor}` — deveria ser `h-9 w-9 rounded-xl bg-primary/10 text-primary` ou usar `KPICard` |

**Correção:** Usar `KPICard` compartilhado (`@/shared/ui/KPICard`) ou alinhar estilo do ícone ao padrão.

---

## 6. `AuthShell` — border-radius hardcoded

| Prioridade | Arquivo | Linha | Problema |
|---|---|---|---|
| 🟢 | `auth/components/AuthShell.tsx` | 118 | `rounded-[32px]` hardcoded — isolado na tela de auth, baixo impacto |

---

## 7. Scheduling — FAB buttons com tamanho custom

| Prioridade | Arquivo | Linha | Problema |
|---|---|---|---|
| 🟢 | `scheduling/components/SchedulingCategoriesTab.tsx` | 26 | `h-8 w-8 rounded-lg` custom em botão FAB |
| 🟢 | `scheduling/components/SchedulingProfessionalsTab.tsx` | 231 | `h-8 w-8 rounded-lg` custom em botão FAB |
| 🟢 | `scheduling/components/SchedulingRecurrencesCard.tsx` | 502 | `h-8 w-8 rounded-lg` custom em botão FAB |

---

## 8. `AutomationStepBuilder` — botão delete icon custom

| Prioridade | Arquivo | Linha | Problema |
|---|---|---|---|
| 🟡 | `automations/components/AutomationStepBuilder.tsx` | 242 | `size="icon" className="h-8 w-8 text-destructive"` — override de tamanho em ícone |

---

## Já corrigido (sessão atual)

- ✅ `agent-rules/components/ModuleAgentRuleDialog.tsx` — Dialog → Sheet, emerald → primary, rounded
- ✅ `settings/components/VoiceAgentConfig.tsx` — removido ícone `<Bot>` de "Persona do Agente"
- ✅ `settings/components/VoiceScriptsEditor.tsx` — `h-8 text-xs` → `text-sm` em todos inputs/selects
- ✅ `automations/components/AutomationStepBuilder.tsx` — todos `h-8 text-xs` removidos, botão delete `h-8 w-8` removido
- ✅ `automations/components/AutomationsList.tsx` — badge `bg-green-100 text-green-800 dark:*` → `bg-success/10 text-success`
- ✅ `social/components/CreateRuleSheet.tsx` — `h-8 text-xs` select + `h-8` input removidos; badge emerald → success
- ✅ `messaging/components/ConversationChargeDialog.tsx` — Dialog → Sheet (side="right"), estrutura sticky header/scroll/footer
- ✅ `social/components/SocialSettingsSheet.tsx` — `w-[100px] h-8 text-xs` → `w-[100px] text-sm`
- ✅ `checkout/components/CheckoutDetailsSheet.tsx` — emerald past-stage → success; button `h-8 text-xs` removido
- ✅ `checkout/components/ShippingPolicySheet.tsx` — 2x `h-8 text-[11px] rounded-lg` → `rounded-lg text-sm`
- ✅ `checkout/components/CheckoutOrdersMesa.tsx` — `h-8 text-[11px]` removidos de action buttons
- ✅ `checkout/views/CheckoutPage.tsx` — `bg-emerald-500/10 text-emerald-400` → success tokens; pulsing dot → `bg-success`
- ✅ `billing/components/BillingHeader.tsx` — `gap-3` → `gap-2` no container de botões
- ✅ `billing/views/BillingUsagePage.tsx` — `text-emerald-500/600` → `text-success` (3 ocorrências)
- ✅ `billing/components/PricingComparisonTable.tsx` — 5x emerald badges/texto → success tokens
- ✅ `settings/components/VoiceMetricsCards.tsx` — ícone container `h-7 w-7 rounded-lg ${bgColor}` → `h-9 w-9 rounded-xl bg-primary/10 text-primary`; removidas cores hardcoded por card
- ✅ `inventory/components/InventoryConnectionsTab.tsx` — `border-green-500/40` → `border-success/40`
- ✅ `scheduling/components/SchedulingCategoriesTab.tsx` — `h-8 w-8` removido do FAB
- ✅ `scheduling/components/SchedulingProfessionalsTab.tsx` — `h-8 w-8` removido do FAB
- ✅ `scheduling/components/SchedulingRecurrencesCard.tsx` — `h-8 w-8` removido do FAB
- ✅ `auth/components/AuthShell.tsx` — `rounded-[32px]` → `rounded-3xl`

---

## Ordem de execução sugerida

1. 🔴 **`automations/components/AutomationStepBuilder.tsx`** — maior concentração de h-8 (item 1)
2. 🔴 **`automations/components/AutomationsList.tsx`** + **`social/components/CreateRuleSheet.tsx`** — emerald badges status (item 2)
3. 🔴 **`messaging/components/ConversationChargeDialog.tsx`** — Dialog → Sheet (item 3)
4. 🟡 **`social/components/SocialSettingsSheet.tsx`** — h-8 select (item 1)
5. 🟡 **`checkout/` componentes** — h-8 buttons + emerald status (itens 1+2)
6. 🟡 **`billing/` componentes** — gap-3 → gap-2 + emerald texto (itens 2+4)
7. 🟡 **`settings/components/VoiceMetricsCards.tsx`** — ícone KPI (item 5)
8. 🟡 **`inventory/components/InventoryConnectionsTab.tsx`** — border-green (item 2)
9. 🟢 Scheduling FABs + AuthShell (itens 6+7)
