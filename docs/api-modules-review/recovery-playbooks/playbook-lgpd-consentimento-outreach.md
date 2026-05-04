# Playbook: LGPD e consentimento no outreach de recuperação

**Âmbito:** mensagens automáticas ou semi-automáticas (`TriggerRecoveryOutreachUseCase`, `SendRecoveryGuidanceUseCase`, filas Bull `recovery-async-jobs`, integração messaging).  
**Objetivo:** reduzir risco regulatório e reclamações mantendo o valor do módulo recovery.

## Princípios

1. **Finalidade e base legal:** tratar recuperação como comunicação com **finalidade legítima** (execução de contrato / legítimo interesse), documentada na política de privacidade do tenant e nos registos internos. Não usar dados recolhidos para finalidades incompatíveis.
2. **Consentimento de marketing:** se o canal (ex.: WhatsApp) exigir **opt-in** específico para mensagens comerciais ou cobrança por canal, não disparar outreach sem evidência desse consentimento ou sem canal autorizado pelo contacto.
3. **Minimização:** não incluir em logs públicos ou em texto ao cliente dados sensíveis desnecessários (saúde, dados detalhados de terceiros).
4. **Transparência:** mensagens devem identificar o credor/empresa e o motivo do contacto; oferecer meio claro de **contactar humano** ou contestar dívida conforme política do tenant.

## Checklist antes de ativar ou ampliar outreach

- [ ] Política de privacidade do tenant menciona **cobrança e comunicações por mensagens** nos canais usados.
- [ ] Base para usar **telefone/e-mail** do contacto está documentada (contrato, relação pré-contratual, opt-in onde aplicável).
- [ ] Limite de **frequência** (cadência) definido por escrito (evitar assédio; alinhar com `RecoveryReplyPolicy` e regras de negócio).
- [ ] Fluxo de **opt-out**: contacto pode pedir para parar; sistema/processo garante bloqueio ou pausa do caso (`UpdateRecoveryCaseStatusUseCase` / estados compatíveis).
- [ ] Conteúdo gerado por IA (`AIRecoveryOutreachGenerator` / guidance) revisto por **política de tom** e proibições (ameaças, linguagem vexatória, dados incorretos).
- [ ] Registos: manter evidência de **quem** aprovou templates ou alterações de cadência em produção.

## Durante incidente ou auditoria

- Recolher: `recoveryCaseId`, `tenantId`, referência de fatura/cobrança (quando existir em logs internos), canal, data do envio.
- Não expor em tickets externos valores completos se não necessário; usar referências internas mascaradas.

## Encaminhamento técnico (código existente)

- Handlers: `RecoveryMessageReceivedHandler`, `RecoveryPaymentEventHandler`, `RecoveryRecurringChargeDueHandler`.
- Ao evoluir observabilidade, preferir correlacionar **`recoveryCaseId`**, **`tenantId`**, **`invoiceOrChargeReference`** em logs estruturados (ver ficha MODULE-recovery).
