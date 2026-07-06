# Spec: MVVM — ConversationsPage

## Objetivo
Refatorar `ConversationsPage.tsx` (1744 linhas) para separar responsabilidades seguindo o padrão MVVM já adotado no projeto. **Zero mudança de comportamento.**

## Problema atual
- View contém 13 funções utilitárias puras embutidas
- View contém 4 estados de apresentação que pertencem ao ViewModel
- View contém `useMemo` derivados dos dados do ViewModel
- View contém ações com lógica de negócio (`copySelectedPhone`)
- `MessageBubble` e outros blocos grandes embutidos no arquivo principal

## Camadas após refatoração

| Camada | Responsabilidade |
|---|---|
| `utils/conversation-ui-helpers.ts` | Funções puras de formatação e derivação de UI |
| `useConversationsPageViewModel.ts` | Estado, mutações, computações derivadas, ações |
| `components/*.tsx` | Sub-componentes isolados (sem lógica) |
| `ConversationsPage.tsx` | Orquestração fina — apenas composição de componentes |

## Requisitos

### CVP-001 — Extrair utilitários puros
Mover para `utils/conversation-ui-helpers.ts`:
- `isProspectConversation`
- `formatConversationPhone`
- `formatConversationClock`
- `formatConversationMoment`
- `parseSaleAmountInput`
- `formatSaleAmountTyping`
- `getQueueSignal`
- `getSentimentMeta`
- `getHandoffGuide`
- `getSignalClassName`
- `getCheckoutStageLabel`
- `getCheckoutStageOrder`
- `getAbandonmentLabel`
- Constantes: `PROSPECT_TAGS`, `QUICK_ACTION_BUTTON_CLASS_NAME`

### CVP-002 — Extrair MessageBubble
Mover `MessageBubble` para `components/MessageBubble.tsx`.

### CVP-003 — Extrair ConversationListItem
Extrair o `<button>` de item da lista para `components/ConversationListItem.tsx`.
Props: `conversation`, `isSelected`, `currentUserId`, `onSelect`.

### CVP-004 — Extrair ConversationContextPanel
Extrair o `<aside>` direito para `components/ConversationContextPanel.tsx`.
Recebe o vm e selectedSignal como props.

### CVP-005 — Extrair SaleAttributionDialog
Extrair o `<Dialog>` de atribuição de venda para `components/SaleAttributionDialog.tsx`.

### CVP-006 — Extrair ConversationChargeDialog
Extrair o `<Dialog>` de cobrança para `components/ConversationChargeDialog.tsx`.

### CVP-007 — Mover estado de apresentação ao ViewModel
Adicionar ao `useConversationsPageViewModel`:
- `saleDialogOpen` / `setSaleDialogOpen`
- `saleNotes` / `setSaleNotes`
- `saleAmountDisplay` / `setSaleAmountDisplay`
- `assistantAutopilotEnabled` / `setAssistantAutopilotEnabled`
- `selectedSignal` (useMemo derivado da conversa selecionada + currentUserId)
- `queueStats` (useMemo: newItems, ownedItems, waitingItems)
- `copySelectedPhone()` — ação com toast
- `handleAttachmentChange(event)` — orquestra setSelectedAttachment

### CVP-008 — Slim down ConversationsPage
`ConversationsPage.tsx` deve ficar < 150 linhas, apenas:
- Refs de DOM (`messagesViewportRef`, `messagesEndRef`)
- Efeito de scroll (DOM concern, refs vivem na View)
- `getAttachmentIcon()` — helper de renderização local
- Composição dos sub-componentes extraídos

## Fora do escopo
- Sem mudança de comportamento
- Sem mudança visual
- Sem novos testes (refactoring puro)

## Gate de verificação
```
cd src/app && npx tsc --noEmit
```
Zero erros TypeScript após refatoração.
