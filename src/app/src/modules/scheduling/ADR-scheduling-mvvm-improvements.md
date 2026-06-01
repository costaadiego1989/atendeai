# ADR — Scheduling Module: MVVM Refactor & UX Improvements

| Campo        | Valor                                          |
|--------------|------------------------------------------------|
| ID           | ADR-scheduling-01                              |
| Status       | Proposed                                       |
| Data         | 2026-06-01                                     |
| Módulo       | `src/app/src/modules/scheduling`               |
| Autores      | Impeccable critique — Claude Code              |

---

## Contexto

Após revisão completa do módulo, foram identificados problemas de arquitetura MVVM e de UX que aumentam o custo de manutenção, dificultam testes e degradam a experiência do usuário em fluxos críticos (agendamento, recorrências, relatórios).

---

## Problemas Identificados

### MVVM — Separação de camadas

#### P1 — `SchedulingProfessionalsTab` contém lógica de negócio (53 KB)

**Achado:** O componente `SchedulingProfessionalsTab.tsx` acumula:
- Filtragem de slots (`openSlots`, `reservedSlots`) via `Array.filter` inline
- `filteredReservedSlots` com `useMemo` e lógica de busca textual
- `activeRecurrences` filter e `generatedRecurrencesCount` reduce
- `rangeTotals` reduce sobre `vm.calendarRange`
- `nextRecurrenceDate` derivado inline
- `window.confirm()` acoplado a `deleteRecurrenceMutation.mutate()`
- Paginação manual (`openSlotsVisible`, `reservedSlotsVisible`)

**Violação:** Na MVVM, o componente View não deve conter derivações de dados nem lógica condicional de negócio. Toda derivação pertence ao ViewModel.

**Impacto:** Impossível testar filtragem/totais sem renderizar o componente. Lógica duplicada se outro componente precisar das mesmas derivações.

---

#### P2 — `activeReportPeriod` calculado na View

**Achado:** Em `SchedulingPage.tsx`:
```tsx
const activeReportPeriod =
  vm.reportFilters.startDate === today && vm.reportFilters.endDate === today
    ? 0
    : (() => { ... diffDays === 7 || diffDays === 30 ? diffDays : null })();
```

**Violação:** Derivação de estado do ViewModel calculada na View. O ViewModel deveria expor `activeReportPeriodDays: 0 | 7 | 30 | null`.

---

#### P3 — Dois arquivos helpers sem contrato de camada claro

**Achado:**
- `components/scheduling-view-helpers.ts` — formatters (formatCurrency, formatSlotTime, getSlotTone)
- `view-models/scheduling-view-model-helpers.ts` — utilitários de data/tempo (isoToday, getWeekDates, normalizePhone, etc.)

**Problema:** Nomes similares com responsabilidades distintas e sem documentação de fronteira. `scheduling-view-helpers.ts` mora em `components/` mas é importado por ViewModels e por componentes indistintamente.

---

#### P4 — ViewModel da página (`useSchedulingPageViewModel`) sem ViewModel dedicado para a tab de Profissionais

**Achado:** A tab de Profissionais tem estado local rico o suficiente para ter seu próprio ViewModel:
- `slotsDayTab` / `scheduleMode` — modo de visualização da tab
- `selectedRecurrence` — entidade selecionada
- `reservedSearch` — filtro de busca
- `openSlotsVisible` / `reservedSlotsVisible` — paginação

Esses estados vivem hoje no componente, misturados com JSX de 53 KB.

---

### UX / Interface

#### U1 — `window.confirm()` para ação destrutiva em recorrências

**Achado:** Em `SchedulingProfessionalsTab.tsx`:
```tsx
if (!window.confirm('Excluir esta recorrência? As sessões já geradas permanecem na agenda.')) {
  return;
}
vm.deleteRecurrenceMutation.mutate(recurrenceId, ...);
```

**Problema:** Dialog nativo quebra o design system. Sem loading state durante a ação. Sem feedback de erro inline.

---

#### U2 — KPI cards sem estado de loading

**Achado:** `SchedulingOverviewCards` exibe `vm.availabilitySlots.length` e `vm.professionals.length` diretamente. Ao trocar de profissional ou data, os números mudam instantaneamente para zero (stale data flicker) sem skeleton.

---

#### U3 — Input de data nativo (`<Input type="date">`) inconsistente com design system

**Achado:** `SchedulingProfessionalsTab` usa `<Input type="date">` para seleção de data. O design system tem componente de calendário (Shadcn Popover + Calendar). O seletor nativo é visualmente inconsistente e não respeita o tema dark.

---

#### U4 — Busca de reservas apenas na tab "Reservados"

**Achado:** O campo `reservedSearch` filtra apenas slots reservados. Slots abertos não têm busca/filtro, mesmo em cenários com muitos slots (geração em lote).

---

#### U5 — Ausência de feedback de progresso na geração em lote (`bulkGenerateSlots`)

**Achado:** `useSchedulingRosterViewModel.ts` gera slots data por data em loop sequencial:
```ts
for (const date of dates) {
  const existingSlots = await schedulingService.getAvailability(...);
  await schedulingService.saveAvailability(...);
}
```
Para 30 dias = 60 chamadas HTTP. A UI fica bloqueada com botão `isPending` sem barra de progresso. Em caso de falha parcial, o usuário não sabe quantos dias foram gerados.

---

#### U6 — Nível excessivo de tabs aninhadas (3 níveis)

**Achado:**
1. `SchedulingPage` — tabs Profissionais / Categorias
2. `SchedulingProfessionalsTab` — tabs Agenda do dia / Recorrentes
3. `SchedulingProfessionalsTab` — tabs Agenda aberta / Reservados

Três níveis de `Tabs` na mesma hierarquia visual. O nível 2 e 3 ficam visualmente colapsados em telas menores, sem indicação do contexto ativo.

---

## Decisões Propostas

### D1 — Criar `useSchedulingProfessionalsTabViewModel`

**O que:** Extrair para um novo hook dedicado toda derivação que hoje vive no componente:

```ts
// view-models/useSchedulingProfessionalsTabViewModel.ts
export function useSchedulingProfessionalsTabViewModel(vm: SchedulingPageViewModel) {
  // estado local da tab
  const [slotsDayTab, setSlotsDayTab] = useState<'open' | 'reserved'>('open');
  const [scheduleMode, setScheduleMode] = useState<'day' | 'recurring'>('day');
  const [selectedRecurrence, setSelectedRecurrence] = useState<...>(null);
  const [reservedSearch, setReservedSearch] = useState('');
  const [openSlotsVisible, setOpenSlotsVisible] = useState(12);
  const [reservedSlotsVisible, setReservedSlotsVisible] = useState(12);

  // derivações
  const openSlots = useMemo(...);
  const reservedSlots = useMemo(...);
  const filteredReservedSlots = useMemo(...);
  const activeRecurrences = useMemo(...);
  const generatedRecurrencesCount = useMemo(...);
  const nextRecurrenceDate = useMemo(...);
  const rangeTotals = useMemo(...);

  // ação confirmada
  function confirmDeleteRecurrence(recurrenceId: string) { ... }

  return { ... };
}
```

**Critério de aceite:** `SchedulingProfessionalsTab.tsx` reduz para ≤ 400 linhas. Zero `useMemo`/`filter`/`reduce` no componente.

---

### D2 — Expor `activeReportPeriodDays` no ViewModel

**O que:** Mover cálculo de `activeReportPeriod` de `SchedulingPage.tsx` para `useSchedulingReportsViewModel`:

```ts
// dentro de useSchedulingReportsViewModel
const activeReportPeriodDays = useMemo<0 | 7 | 30 | null>(() => {
  if (reportFilters.startDate === today && reportFilters.endDate === today) return 0;
  const diff = Math.round((endMs - startMs) / 86_400_000);
  return diff === 7 || diff === 30 ? diff : null;
}, [reportFilters]);
```

**Critério de aceite:** `SchedulingPage.tsx` não contém nenhum `useMemo`, `useEffect` ou cálculo de datas.

---

### D3 — Reorganizar helpers em contratos de camada explícitos

**O que:** Renomear e mover para deixar responsabilidades claras:

| Arquivo atual | Arquivo novo | Responsabilidade |
|---|---|---|
| `components/scheduling-view-helpers.ts` | `view-models/scheduling-formatters.ts` | Formatação de display (currency, time, tone) |
| `view-models/scheduling-view-model-helpers.ts` | `view-models/scheduling-date-utils.ts` | Utilitários de data/tempo puros |

**Critério de aceite:** Nenhum arquivo em `components/` é importado por ViewModels. Formatters não importam utilitários de negócio.

---

### D4 — Substituir `window.confirm()` por AlertDialog

**O que:** Criar `SchedulingDeleteRecurrenceDialog` usando `AlertDialog` do Shadcn:

```tsx
<AlertDialog open={confirmDeleteId !== null} onOpenChange={...}>
  <AlertDialogContent>
    <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
    <AlertDialogDescription>
      As sessões já geradas permanecem na agenda.
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        disabled={vm.deleteRecurrenceMutation.isPending}
        onClick={() => vm.deleteRecurrenceMutation.mutate(confirmDeleteId)}
      >
        Excluir
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Critério de aceite:** Zero `window.confirm()` no módulo. Ação bloqueada com `disabled` durante `isPending`.

---

### D5 — Adicionar skeletons nos KPI cards durante loading

**O que:** `SchedulingOverviewCards` deve verificar `vm.professionalsQuery.isLoading` e `vm.availabilityQuery.isLoading` e renderizar `<Skeleton>` nos valores.

**Critério de aceite:** Nenhum card exibe zero instantâneo ao trocar professional/data. Skeleton visível por ≥ 200ms (ou até query resolver).

---

### D6 — Substituir `<Input type="date">` por Date Picker do design system

**O que:** Usar `Popover` + `Calendar` (Shadcn) em `SchedulingProfessionalsTab` para seleção de data, consistente com o restante do design system.

**Critério de aceite:** Nenhum `<Input type="date">` no módulo. Date picker respeita tema dark/light.

---

### D7 — Adicionar progresso ao gerador em lote

**O que:** Em `useSchedulingRosterViewModel`, expor estado de progresso da geração:

```ts
const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
```

Atualizar `setBulkProgress` a cada iteração do loop. Expor no return do ViewModel.

**Critério de aceite:** UI exibe barra de progresso ou texto `"X de Y dias gerados"` durante geração. Em falha parcial, toast informa quantos dias foram gerados antes do erro.

---

## Mapa de Mudanças por Arquivo

| Arquivo | Ação | Prioridade |
|---|---|---|
| `view-models/useSchedulingProfessionalsTabViewModel.ts` | **CRIAR** | P1 |
| `components/SchedulingProfessionalsTab.tsx` | REFATORAR — remover derivações | P1 |
| `view-models/useSchedulingReportsViewModel.ts` | ADICIONAR `activeReportPeriodDays` | P1 |
| `views/SchedulingPage.tsx` | REMOVER cálculo inline de report period | P1 |
| `view-models/scheduling-formatters.ts` | **CRIAR** (mover de view-helpers) | P2 |
| `view-models/scheduling-date-utils.ts` | **CRIAR** (renomear de vm-helpers) | P2 |
| `components/scheduling-view-helpers.ts` | DELETAR após migração | P2 |
| `components/SchedulingDeleteRecurrenceDialog.tsx` | **CRIAR** | P2 |
| `components/SchedulingOverviewCards.tsx` | ADICIONAR skeleton loading | P2 |
| `view-models/useSchedulingRosterViewModel.ts` | ADICIONAR `bulkProgress` | P3 |
| `components/SchedulingProfessionalsTab.tsx` | SUBSTITUIR Input type=date | P3 |

---

## Critérios de Aceite Globais

- [ ] `SchedulingProfessionalsTab.tsx` ≤ 400 linhas
- [ ] Zero `useMemo`/`filter`/`reduce` em componentes View do módulo
- [ ] Zero `window.confirm()` no módulo
- [ ] Zero `<Input type="date">` no módulo
- [ ] `SchedulingPage.tsx` sem cálculos derivados (apenas `useSchedulingPageViewModel()` + JSX)
- [ ] KPI cards exibem skeleton durante queries em loading
- [ ] Geração em lote exibe progresso incremental
- [ ] Todos os testes existentes passam após refator

---

## Não está no escopo deste ADR

- Mudanças de estilo visual (cores, tipografia) — sem PRODUCT.md/DESIGN.md como referência
- Alterações no backend ou no `scheduling-service.ts`
- Migração para estado global (Zustand/Jotai) — o padrão atual de hooks compostos é adequado
- Implementação de APP-SCH-004 (OAuth callback) — já documentado no IMPLEMENTATION-GAP.md
