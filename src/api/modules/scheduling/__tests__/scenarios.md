# Análise e Bateria de Testes — Módulo Scheduling (Agendamentos)

O módulo `scheduling` é o motor de reservas do AtendeAi. Ele opera em um modelo híbrido: **Redis** para gerenciamento de slots e concorrência (hot store) e **Prisma** para configurações persistentes e integrações. É tecnicamente o módulo mais complexo devido à necessidade de garantir que dois clientes não reservem o mesmo horário simultaneamente.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports)** | `ISchedulingStore` (Contrato Redis), `ISchedulingReservationExpirationQueue` (BullMQ), `ISchedulingGoogleCalendarConnectionRepository`. |
| **Logic (Facades)** | `SchedulingFacade` (Interface interna para outros módulos). |
| **Use Cases (20)** | Destaque para `ReserveProfessionalSlot` (Core), `RescheduleSchedulingReservation`, `UpdateAvailabilitySlot`. |
| **Services** | `SchedulingGoogleCalendarSyncService` (Sincronização bidirecional), `SchedulingPaymentReference`. |
| **Infrastructure** | `RedisSchedulingStore` (Implementação com `ioredis`), `Prisma...Repositories`. |

---

## Cobertura Atual (Apenas 3 Arquivos - Deficiência Crítica)

O nível de cobertura atual é extremamente baixo para a importância do módulo.

### 🟡 Cobertura Parcial (IA e Google)
- `SchedulingGoogleCalendarSyncService.spec.ts` cobre a lógica de mapeamento de eventos, o que é bom.
- `GetGoogleCalendarConnectionStatusUseCase.spec.ts` cobre um fluxo simples de consulta.

### 🔴 O "Mega UseCase" Desprotegido
O `ReserveProfessionalSlotUseCase.ts` possui **388 linhas de lógica transacional pura** (resolução de categorias, verificação de contato, integração com pagamento PIX, enfileiramento de expiração no BullMQ, envio de WhatsApp e Sync com Google Calendar). **Não possui nenhum teste unitário.** Uma falha aqui impede agendamentos em toda a plataforma.

### 🔴 Concorrência em Redis
O `RedisSchedulingStore` usa `WATCH/MULTI/EXEC` para evitar double-booking. Sem testes unitários simulando falhas de `WATCH` (Race Conditions), não há garantia de que o sistema é thread-safe.

---

## Proposta de Bateria de Testes

### FASE 1 — Concorrência e Persistência Hot (Priority: 🔴 CRITICAL)

##### `RedisSchedulingStore.spec.ts` (NEW)
- Usar `ioredis-mock` para testar o armazenamento.
- **Race Condition Test**: Simular que um `reserveSlot` falha porque outro processo mudou a chave durante o `WATCH`.
- **Validation**: Garantir que `AVAILABLE` não pode ser reservado se já estiver `RESERVED` ou `BLOCKED`.
- **TTL**: Verificar se os slots de disponibilidade expiram corretamente após 48h do dia do agendamento.

### FASE 2 — O Coração do Agendamento (Priority: 🔴 CRITICAL)

##### `ReserveProfessionalSlotUseCase.spec.ts` (NEW)
- **Cenário Free**: Reservar slot grátis -> Verificar se envia WhatsApp de confirmação e sincroniza Google.
- **Cenário Paid (Pre-Reservation)**: Reservar slot pago -> Verificar se gera link de pagamento, enfileira expiração no BullMQ e **não** confirma no Google Calendar ainda (ou cria como 'Tentative').
- **Integrity**: Garantir que se a criação do link de pagamento falhar, o slot no Redis é liberado (`cancelReservationSilently`).

### FASE 3 — Lifecycle & Expiração (Priority: 🔴 HIGH)

##### `ExpirePendingSchedulingReservationUseCase.spec.ts` (NEW)
- Testar se ao expirar um job do BullMQ, o slot volta para `AVAILABLE` no Redis.
- Garantir que se o pagamento já tiver sido confirmado (`PAID`), o job de expiração não faça nada.

##### `RescheduleSchedulingReservationUseCase.spec.ts` (NEW)
- Validar transação atômica: liberar Slot A e ocupar Slot B em uma única operação.

### FASE 4 — Integração Google Calendar (Priority: 🟡 MEDIUM)

##### `GoogleCalendarIntegration.integration.spec.ts` (NEW)
- Mockar a API do Google para garantir que falhas na API deles não travam o agendamento no AtendeAi (Resiliência).

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Unit — Core Use Cases** | 1 | ~15 | 16 |
| **Unit — Services/Facades** | 1 | ~5 | 6 |
| **Unit — Persistence (Redis)** | **0** | **~8** | **8** |
| **Unit — Queue/Workers** | 0 | ~4 | 4 |
| **Integration (Google/Prisma)** | 0 | ~6 | 6 |
| **E2E (Controllers)** | 1 | 0 | 1 |
| **TOTAL** | **~3** | **~38** | **~41** |

---

## User Review Required

> [!CAUTION]
> O módulo de agendamento é o mais sensível a **Race Conditions**. Se dois clientes tentarem o mesmo slot ao mesmo tempo, apenas um deve conseguir. O código atual usa `redis.watch(key)`, o que é o caminho certo, mas **precisamos de testes unitários que forcem explicitamente a falha do watch** para validar o rollback. Além disso, o Use Case `ReserveProfessionalSlot` está muito "gordo". Durante a implementação dos testes, se houver muitos mocks necessários, recomendo uma leve refatoração para extrair a lógica de Pagamento para um sub-serviço. Aprova essa abordagem de "Test-Driven Refactoring" se necessário?

## Verification Plan

### Automated Tests
```bash
npx jest --testPathPattern="src/modules/scheduling" --verbose
```
