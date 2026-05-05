# Análise e Bateria de Testes — Módulo Alerts (Alertas e Lembretes)

O módulo `alerts` é responsável por gerenciar lembretes internos para os usuários do AtendeAi. Ele permite configurar alertas únicos ou diários (WhatsApp) e utiliza uma fila (BullMQ) para processar os envios no momento exato.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Types/Repositories)** | `AlertReminder` (Interface de dados), `IAlertReminderRepository`. |
| **Logic (Helpers)** | `alert-reminder-schedule.ts` (Core logic para cálculo de cronograma). |
| **Use Cases (5)** | `CreateAlertReminder`, `ListAlertReminders`, `UpdateAlertReminder`, `DeleteAlertReminder`, `ProcessAlertReminder`. |
| **Infrastructure** | `PrismaAlertReminderRepository`, `AlertReminderQueue` (BullMQ wrapper). |
| **Dependencies** | `ContactFacade` (Criação de contatos internos), `MessagingFacade` (Envio WhatsApp). |

---

## Cobertura Atual (2 Arquivos de Teste - Parcial)

Existem testes unitários iniciais, mas os casos de borda do agendamento não estão cobertos.

### ✅ Cobertura Existente
- `CreateAlertReminderUseCase.spec.ts`: Valida a criação básica e enfileiramento inicial.
- `ProcessAlertReminderUseCase.spec.ts`: Valida o disparo do WhatsApp e o cálculo do *próximo* disparo diário.

### 🔴 Gaps de Agendamento (Schedules)
A lógica em `alert-reminder-schedule.ts` (que decide se o alerta deve tocar "daqui a pouco" ou "amanhã" se o horário atual já passou do `timeOfDay`) não tem testes unitários. Isso é propenso a erros de fuso horário ou cálculos de virada do dia.

### 🔴 CRUD Residual e Rescheduling
- **`UpdateAlertReminderUseCase.ts`**: Não possui testes. Este Use Case é complexo pois deve reagendar o job na fila caso o horário ou a frequência mude.
- **`PrismaAlertReminderRepository`**: Não possui testes de integração, o que é importante para validar o filtro de `Status` e `AuthUserId`.

---

## Proposta de Bateria de Testes

### FASE 1 — Precisão de Cronograma (Priority: 🔴 CRITICAL)

##### `alert-reminder-schedule.spec.ts` (NEW)
- **Horário Futuro**: Testar se agendar para as 18:00 (sendo 14:00 agora) retorna o mesmo dia.
- **Horário Passado**: Testar se agendar para as 10:00 (sendo 14:00 agora) retorna o **dia seguinte**.
- **Edge Cases**: Transição de meses e anos nos agendamentos `ONCE`.

### FASE 2 — Reagendamento e CRUD (Priority: 🔴 HIGH)

##### `UpdateAlertReminderUseCase.spec.ts` (NEW)
- **Status Change**: Garantir que ao marcar como `INACTIVE`, o agendamento futuro é removido ou ignorado.
- **Frequency Flip**: Testar a mudança de `DAILY` para `ONCE` e vice-versa.
- **Permission**: Validar que um usuário não pode editar lembretes de outro usuário.

### FASE 3 — Persistência e Filtros (Priority: 🟡 MEDIUM)

##### `PrismaAlertReminderRepository.integration.spec.ts` (NEW)
- Validar `findById` e `findByUser` garantindo que o tenant boundary é respeitado.

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Unit — Use Cases** | 2 | ~3 | 5 |
| **Unit — Schedule Helpers** | **0** | **~5** | **5** |
| **Integration (Prisma)** | 0 | ~2 | 2 |
| **E2E (Controllers)** | 0 | ~1 (Opcional) | 1 |
| **TOTAL** | **~2** | **~11** | **~13** |

---

## User Review Required

> [!TIP]
> O módulo de alertas é pequeno, mas a lógica de **Rescheduling** (ao editar um lembrete) pode gerar "jobs fantasmas" na fila se não for bem gerenciada. Minha proposta de teste focará em garantir que `UpdateAlertReminder` sempre gere o próximo `nextTriggerAt` correto e que este seja repassado à fila BullMQ.

## Verification Plan

### Automated Tests
```bash
npx jest --testPathPattern="src/modules/alerts" --verbose
```
