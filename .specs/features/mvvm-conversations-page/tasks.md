# Tasks: MVVM — ConversationsPage

## Status: DONE

---

## T1 — Criar utils/conversation-ui-helpers.ts [ ]
**What:** Mover todas as funções puras + constantes de `ConversationsPage.tsx` para novo arquivo de helpers.
**Where:** `src/app/src/modules/messaging/utils/conversation-ui-helpers.ts` (novo)
**Source functions:** `isProspectConversation`, `formatConversationPhone`, `formatConversationClock`, `formatConversationMoment`, `parseSaleAmountInput`, `formatSaleAmountTyping`, `getQueueSignal`, `getSentimentMeta`, `getHandoffGuide`, `getSignalClassName`, `getCheckoutStageLabel`, `getCheckoutStageOrder`, `getAbandonmentLabel`
**Source constants:** `PROSPECT_TAGS`, `QUICK_ACTION_BUTTON_CLASS_NAME`
**Done when:** Arquivo criado com exports corretos; funções removidas do Page.
**Req:** CVP-001

---

## T2 — Estender useConversationsPageViewModel [ ]
**What:** Adicionar ao ViewModel: estados de diálogo, assistantAutopilot, selectedSignal, queueStats, copySelectedPhone, handleAttachmentChange.
**Where:** `src/app/src/modules/messaging/view-models/useConversationsPageViewModel.ts`
**Depends on:** T1 (importa helpers)
**Additions:**
- `saleDialogOpen`, `setSaleDialogOpen`
- `saleNotes`, `setSaleNotes`
- `saleAmountDisplay`, `setSaleAmountDisplay`
- `assistantAutopilotEnabled`, `setAssistantAutopilotEnabled`
- useEffect: reset autopilot quando conversation muda
- `selectedSignal` useMemo (usa `getQueueSignal` de T1)
- `queueStats` useMemo (newItems, ownedItems, waitingItems)
- `copySelectedPhone()` — navigator.clipboard + toast
- `handleAttachmentChange(event: ChangeEvent<HTMLInputElement>)` — chama setSelectedAttachment
**Done when:** ViewModel retorna todos os novos campos sem erro TS.
**Req:** CVP-007

---

## T3 — Extrair MessageBubble [ ]
**What:** Mover `MessageBubble` function component para arquivo próprio.
**Where:** `src/app/src/modules/messaging/components/MessageBubble.tsx` (novo)
**Depends on:** T1 (usa `formatConversationClock`)
**Done when:** Componente exportado; importado corretamente no Page.
**Req:** CVP-002

---

## T4 — Extrair ConversationListItem [ ]
**What:** Extrair o `<button>` de item da lista de conversas para componente próprio.
**Where:** `src/app/src/modules/messaging/components/ConversationListItem.tsx` (novo)
**Depends on:** T1 (usa helpers), T2 (tipos do vm)
**Props:**
```ts
interface ConversationListItemProps {
  conversation: ReturnType<typeof useConversationsPageViewModel>['conversations'][number];
  isSelected: boolean;
  currentUserId: string | null;
  onSelect: (id: string) => void;
}
```
**Done when:** Componente exportado; importado no Page.
**Req:** CVP-003

---

## T5 — Extrair SaleAttributionDialog [ ]
**What:** Extrair Dialog de atribuição de venda.
**Where:** `src/app/src/modules/messaging/components/SaleAttributionDialog.tsx` (novo)
**Depends on:** T2 (vm props), T1 (parseSaleAmountInput, formatSaleAmountTyping)
**Props:** recebe do vm: `open`, `onOpenChange`, `saleNotes`, `setSaleNotes`, `saleAmountDisplay`, `setSaleAmountDisplay`, `saleDialogCopy`, `markSaleAttributionMutation`, `selectedConversation`
**Done when:** Dialog extraído + importado no Page.
**Req:** CVP-005

---

## T6 — Extrair ConversationChargeDialog [ ]
**What:** Extrair Dialog de cobrança.
**Where:** `src/app/src/modules/messaging/components/ConversationChargeDialog.tsx` (novo)
**Depends on:** T2 (vm props)
**Props:** recebe do vm: `open`, `onOpenChange`, `chargeForm`, `setChargeForm`, `formatConversationChargeValue`, `createConversationChargeMutation`, `submitConversationCharge`
**Done when:** Dialog extraído + importado no Page.
**Req:** CVP-006

---

## T7 — Extrair ConversationContextPanel [ ]
**What:** Extrair `<aside>` direito (contexto e ações).
**Where:** `src/app/src/modules/messaging/components/ConversationContextPanel.tsx` (novo)
**Depends on:** T1, T2, T5
**Props:** vm completo + selectedSignal
**Done when:** Componente extraído + importado no Page.
**Req:** CVP-004

---

## T8 — Slim down ConversationsPage [ ]
**What:** Reduzir ConversationsPage.tsx a < 150 linhas — apenas refs, scroll effect, getAttachmentIcon e composição.
**Where:** `src/app/src/modules/messaging/views/ConversationsPage.tsx`
**Depends on:** T1, T2, T3, T4, T5, T6, T7
**Done when:** Arquivo < 150 linhas; zero erros TS.
**Req:** CVP-008

---

## Gate final
```
cd src/app && npx tsc --noEmit
```
