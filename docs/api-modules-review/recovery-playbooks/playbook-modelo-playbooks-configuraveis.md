# Playbook: modelo para *playbooks configuráveis* (especificação futura)

**Estado:** documento de **alinhamento**; não implica campos ou tabelas implementados no repositório. Serve para quando a equipa implementar “playbooks configuráveis” mencionados em MODULE-recovery.

## Objetivo

Permitir que um **tenant** (ou filial) defina uma sequência de **fases** de recuperação com regras explícitas, em vez de lógica fixa apenas em código.

## Entidades conceituais

| Entidade | Descrição |
|----------|-----------|
| **Playbook** | Conjunto nomeado de fases; versão (v1, v2) para mudanças sem quebrar casos antigos. |
| **Fase** | Ordem, canal permitido (ex.: WHATSAPP), atraso mínimo desde fase anterior, template ou “modo IA”, condição de entrada (ex.: dias em atraso). |
| **Política global** | Cooldown máximo por contacto/dia; respeito a opt-out; feriados (opcional). |

## Requisitos funcionais (rascunho)

1. Um **caso de recovery** referencia `playbookId` + `faseAtual` (ou índice).
2. Transições disparadas por: **tempo**, **resposta do devedor**, **pagamento**, **ação manual do agente**.
3. **Idempotência:** reprocessar job não duplica mensagem na mesma fase (chave idempotente por `recoveryCaseId` + `faseId` + `attempt`).
4. **Feature flag:** playbooks só ativos para tenants na allowlist até validação jurídica/comercial.

## Requisitos não funcionais

- Logs com `recoveryCaseId`, `tenantId`, `invoiceOrChargeReference`.
- Auditoria: quem alterou o playbook e quando.
- Testes de contrato nos geradores IA (`AIRecoveryGuidanceGenerator`, `AIRecoveryOutreachGenerator`) para não vazar instruções do sistema.

## Migração desde o estado atual

1. Mapear fluxos hardcoded atuais (outreach, guidance, recorrente) para **um playbook padrão “sistema”**.
2. Permitir clone do playbook padrão por tenant antes de edições avançadas.
3. Documentar diferença entre **promessa de pagamento calendarizada** (feature futura) e fase “aguardar até data”.

## Critérios de aceite (quando implementar)

- [ ] Criar/editar playbook sem deploy (API ou admin).
- [ ] Caso novo herda playbook activo da filial ou fallback tenant.
- [ ] Métricas por playbook (taxa recuperação por fase).
