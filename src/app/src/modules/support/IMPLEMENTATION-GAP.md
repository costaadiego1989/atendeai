# IMPLEMENTATION-GAP — `support` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `support` |
| Data | 2026-05-04 |
| API relacionada | `support` (`SupportFeedbackController`) |

## Superfície já coberta

- Cliente: [`services/support-service.ts`](./services/support-service.ts)
- Rotas utilizadas:
  - `GET /support/feedbacks` (`branchId` opcional)
  - `POST /support/feedbacks`

Backend: [`SupportFeedbackController.ts`](../../../../api/modules/support/presentation/controllers/SupportFeedbackController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-SUP-001 | P2 | API só lista/cria — sem update/delete no controller atual; se roadmap incluir status/resposta operador, UI ausente | Produto |
| APP-SUP-002 | P1 | Cobrir erros de validação `CreateSupportFeedbackDTO` com mensagens estáveis na UI | [x] Resolvido 2026-05-12 |

### Resolução APP-SUP-002

**Problema:** Erros de validação 400 do NestJS `ValidationPipe` (class-validator) eram exibidos como mensagens brutas em inglês ou caíam no fallback genérico.

**Correção:** Adicionado `mapValidationMessage` em `shared/api/error-message.ts`:
- Detecta status 400 com array de mensagens de validação no `details.message`
- Traduz constraints class-validator para português (MaxLength, IsIn, IsString, etc.)
- Limita exibição a 3 mensagens para não poluir o toast
- Integrado na cadeia de resolução do `getFriendlyErrorMessage` (antes de `mapPrismaLikeMessage`)

## Alinhamento de contrato

- `tenantId` vem do JWT — não enviar tenant duplicado no body.

## Verificação (Done when)

- MSW ou teste componente FAB/contextual envia feedback com `appModule` e `pagePath`.
