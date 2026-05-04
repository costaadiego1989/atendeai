# Módulo: `recovery`

**Caminho:** `src/api/modules/recovery`  
**Última análise:** 2026-05-04  
**Papel:** cobrança inadimplência / recuperação — casos, orientações IA, outreach, relatórios, jobs recorrentes.

## Estado da implementação (revisão 2026-05-04)

- **Código:** fluxos existentes mantêm-se (`recovery-async-jobs`, handlers payment/message/recorrente, geradores IA).
- **Melhorias da ficha (playbooks configuráveis, LGPD, dashboard):** nesta revisão apenas **documentação operacional** — ver pasta **[recovery-playbooks](./recovery-playbooks/README.md)** (checklist LGPD, métricas carteira, modelo futuro para playbooks configuráveis). Implementação produto dessas linhas permanece roadmap.

## Valor ao utilizador / oportunidades

- Diretamente aumenta recuperação de receita mantendo tom regulatório/emocional correto via IA opcional.
- **Melhorias:** playbooks configuráveis (spec em playbook modelo); limites LGPD/consentimento (checklist); dashboard carteira recuperada vs enviado (definições no playbook métricas).
- **Features:** promises-to-pay calendarizadas; integrações com gateways de negociação.

## Acoplamento / manutenção

- Depende Auth, Contact, Messaging, **AIModule**, Bull queues — forte dependência comunicacional esperada.

## Logs e traces distribuídos

- Processors asíncronos e charges recorrentes: padronizar `recoveryCaseId`, `tenantId`, `invoiceOrChargeReference` onde aplicável; alertas só em falhas repetidas.

## KISS / DRY

- `AIRecovery*` generators devem compartilhar utilitários de prompt/safety com módulo `recovery`-agnostic se duplicarem prevenções de prompt injection entre recovery e messaging.
