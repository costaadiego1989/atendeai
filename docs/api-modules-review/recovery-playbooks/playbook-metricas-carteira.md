# Playbook: métricas de carteira — enviado vs recuperado

**Contexto:** o MODULE-recovery prevê dashboard de carteira recuperada versus comunicações enviadas; até lá, equipas podem usar **relatórios CSV** e métricas agregadas já expostas pela API.

## Definições recomendadas (produto)

| Métrica | Definição sugerida | Fonte típica no sistema |
|--------|---------------------|-------------------------|
| **Carteira em recuperação** | Conjunto de casos com estado “ativo” de cobrança (ex.: não liquidados / não cancelados). | Casos em `recovery_schema` via listagens/API recovery. |
| **Enviado** | Tentativas de comunicação outbound ligadas ao caso (guidance enviado, outreach disparado, mensagens sistema associadas ao fluxo). | Registos de envio / jobs completados; messaging outbound quando correlacionado ao caso. |
| **Recuperado** | Valor ou casos marcados como **resolvidos com pagamento** ou equivalente (`RecoveryPaymentEventHandler` após confirmação de pagamento quando aplicável ao reference recovery). | Eventos payment + atualização de estado do caso. |
| **Taxa de conversão** | Recuperado ÷ carteira ou Recuperado ÷ Enviado (definir denominador único por produto). | Derivado das anteriores. |

## Como operar hoje (sem dashboard)

1. Gerar relatório quando existir endpoint/fluxo de **export CSV** (`GenerateRecoveryReportUseCase` / jobs `EXPORT_RECOVERY_REPORT_CSV` na fila `recovery-async-jobs`).
2. Validar período (`dateFrom` / `dateTo`) e **tenant/branch** para evitar misturar carteiras.
3. Cruzar manualmente com eventos de **pagamento confirmado** do gateway (referência recovery) para marcar recuperações.
4. Documentar **uma única definição** de “recuperado” na equipa comercial/financeira para relatórios externos.

## Alertas

- Falhas repetidas de job: investigar apenas após **N repetições** (evitar ruído); guardar `queue_job_id` e `recoveryCaseId` quando existir.
- Discrepância grande entre “enviado” e respostas no messaging: rever **consentimento** e qualidade das mensagens (ver playbook LGPD).

## Roadmap produto

- Quando existir dashboard: fixar estas definições no próprio UI (tooltips e documentação embutida).
