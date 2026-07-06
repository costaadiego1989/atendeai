# Prospecting Enterprise Campaign Engine — Specification

## Problem Statement

O módulo de prospecção atual envia texto livre via `messagingFacade.queueSystemMessage`, o que viola a política da Meta para mensagens iniciadas pelo negócio (business-initiated). Sem templates aprovados, rate limiting inteligente e proteção anti-abuso, cada conta de cliente corre risco de ban permanente da WhatsApp Business API. Precisamos de uma engine de campanha enterprise que seja nativa às regras da Meta, gere valor real de prospecção e proteja a reputação da conta de cada tenant.

## Goals

- [ ] Envio de campanhas de prospecção usando templates aprovados pela Meta (não texto livre)
- [ ] IA personaliza variáveis do template por contato (nome, segmento, cidade)
- [ ] Anti-abuso: cooldown por contato, delay randomizado, auto-pause por block rate
- [ ] Badge visual de status de prospecção na lista de empresas/contatos
- [ ] Bloqueio de reenvio para contatos já prospectados
- [ ] Webhook Meta de qualidade: receber reports de spam/bloqueio e reagir automaticamente

## Out of Scope

| Feature | Reason |
|---|---|
| Integração Google Ads / Google Places | Usuário não usa; excluído por decisão de produto |
| CTWA (Click-to-WhatsApp Ads) webhook | Próxima fase; requer integração Meta Ads API separada |
| Instagram DM como canal de campanha | Canal existe mas fora do escopo desta feature |
| UI de gerenciamento de templates (aprovação) | Templates são gerenciados direto no Meta Business Manager |
| Billing por mensagem enviada | Fora do escopo desta feature |

---

## User Stories

### P1: PROSP-01 — Campanha via Template Aprovado ⭐ MVP

**User Story**: Como tenant, quero criar uma campanha de prospecção usando um template aprovado pela Meta, com variáveis preenchidas pela IA, para que cada mensagem seja personalizada e dentro das regras.

**Why P1**: Sem isso, qualquer envio em massa viola política Meta. Core do valor.

**Acceptance Criteria**:

1. WHEN tenant cria campanha THEN sistema SHALL permitir selecionar `templateName` (nome do template aprovado no Meta Business Manager) como alternativa a `messageTemplate` texto livre
2. WHEN campanha tem `templateName` definido THEN `DispatchProspectExecutionUseCase` SHALL chamar `messagingFacade.queueTemplateMessage()` ao invés de `queueSystemMessage()`
3. WHEN campanha tem `templateVariableMapping` (ex: `{1: "name", 2: "segment", 3: "city"}`) THEN sistema SHALL preencher variáveis com dados do contato antes de enviar
4. WHEN variável não encontrada no contato THEN sistema SHALL usar valor fallback configurado ou omitir graciosamente (não quebrar dispatch)
5. WHEN `templateName` não fornecido THEN sistema SHALL rejeitar ativação da campanha com erro claro: "Template obrigatório para campanhas WhatsApp"

**Independent Test**: Criar campanha com templateName + ativar + verificar que execução chama queueTemplateMessage com variáveis corretas.

---

### P1: PROSP-02 — Bloqueio de Reenvio e Badge de Status ⭐ MVP

**User Story**: Como tenant, quero ver na lista de contatos/empresas quais já foram prospectados e ser impedido de enviar nova mensagem para eles, para evitar spam e manter controle.

**Why P1**: Reenvio acidental é a causa número 1 de spam reports. Badge é o feedback visual necessário.

**Acceptance Criteria**:

1. WHEN contato possui `ProspectExecution` com status `CONTACTED` ou `RESPONDED` THEN lista de contatos SHALL exibir badge "Prospectado" com data do último contato
2. WHEN tenant tenta incluir contato já `CONTACTED` em nova campanha ativa THEN sistema SHALL bloquear a execução para aquele contato e registrar `stopReason: ALREADY_CONTACTED`
3. WHEN contato tem `attemptCount >= 1` e status `CONTACTED` THEN `ProspectDispatchPolicy` SHALL rejeitar dispatch com erro `PROSPECT_ALREADY_CONTACTED`
4. WHEN contato tem status `RESPONDED` THEN badge SHALL mostrar "Respondeu" (diferente de "Prospectado")
5. WHEN contato tem status `STOPPED` THEN badge SHALL mostrar "Parado" com `stopReason`

**Independent Test**: Criar execução CONTACTED → tentar dispatch novamente → verificar rejeição. Verificar endpoint retorna status por contactId.

---

### P1: PROSP-03 — Anti-Abuso: Cooldown e Delay Randomizado ⭐ MVP

**User Story**: Como plataforma, quero que o sistema respeite cooldown mínimo entre contatos e adicione delay randomizado entre envios, para proteger a conta do tenant contra detecção de spam pela Meta.

**Why P1**: Sem isso, 500 mensagens em sequência rápida = padrão de spam detectável = ban.

**Acceptance Criteria**:

1. WHEN sistema vai despachar execução THEN `ProspectDispatchPolicy` SHALL verificar se contato recebeu mensagem nos últimos `cooldownDays` (default: 30 dias)
2. WHEN contato dentro do período de cooldown THEN dispatch SHALL ser bloqueado com `stopReason: COOLDOWN_ACTIVE`
3. WHEN job despacha próxima execução da campanha THEN SHALL aguardar delay randomizado entre `minDelaySeconds` e `maxDelaySeconds` (defaults: 30s-120s, configurável por campanha)
4. WHEN `dailyLimit` atingido THEN job SHALL parar dispatch do dia e reagendar para próximo dia
5. WHEN campanha tem `cooldownDays` configurado THEN valor SHALL sobrescrever o default da plataforma

**Independent Test**: Criar 3 execuções em sequência → verificar que delays existem entre elas. Contato com CONTACTED recente → verificar bloqueio por cooldown.

---

### P2: PROSP-04 — Auto-Pause por Block Rate

**User Story**: Como plataforma, quero pausar automaticamente uma campanha quando a taxa de bloqueio/spam reports exceder o threshold configurado, para proteger o Quality Rating da conta WhatsApp do tenant.

**Why P2**: Proteção proativa. Sem isso tenant pode perder conta sem perceber.

**Acceptance Criteria**:

1. WHEN campanha ativa tem `blockRate > blockRateThreshold` (default: 5%) no período de 7 dias THEN sistema SHALL pausar campanha automaticamente com `pauseReason: HIGH_BLOCK_RATE`
2. WHEN campanha é auto-pausada THEN sistema SHALL criar alerta para o tenant com block rate atual e threshold
3. WHEN tenant reativa campanha pausada por block rate THEN sistema SHALL exigir confirmação explícita
4. WHEN `blockRateThreshold` não configurado THEN sistema SHALL usar valor default de 5%

**Independent Test**: Simular execuções com stopReason BLOCKED → verificar auto-pause quando threshold atingido.

---

### P2: PROSP-05 — Webhook Meta de Qualidade

**User Story**: Como plataforma, quero receber webhooks da Meta quando usuário bloqueia ou reporta spam, para atualizar status do contato e reagir antes do ban.

**Why P2**: Fecha o loop de feedback. Sem isso, só descobrimos problemas depois do ban.

**Acceptance Criteria**:

1. WHEN Meta envia webhook de evento `message_status` com status `failed` ou `read` THEN sistema SHALL atualizar status da execução correspondente
2. WHEN Meta envia evento de bloqueio/spam report de contato THEN sistema SHALL marcar contato com flag `prospectingOptOut: true`
3. WHEN contato tem `prospectingOptOut: true` THEN `ProspectDispatchPolicy` SHALL bloquear qualquer dispatch futuro para ele
4. WHEN webhook recebido THEN sistema SHALL validar assinatura HMAC da Meta antes de processar
5. WHEN contato é marcado opt-out THEN sistema SHALL registrar `ProspectExecution.stopReason: OPT_OUT`

**Independent Test**: Enviar payload webhook simulado → verificar que contato é marcado opt-out e dispatch bloqueado.

---

### P3: PROSP-06 — IA Sugere Variáveis por Contato

**User Story**: Como tenant, quero que a IA sugira/gere os valores das variáveis do template baseada nos dados do contato, para que cada mensagem seja genuinamente personalizada sem esforço manual.

**Why P3**: Aumenta conversão. Base existe (`SuggestProspectCampaignMessageUseCase`). Extensão natural.

**Acceptance Criteria**:

1. WHEN campanha tem `aiVariableGeneration: true` e `templateVariableMapping` THEN sistema SHALL chamar `AIModule` para gerar valor de cada variável contextualizado ao contato
2. WHEN IA gera variável THEN resultado SHALL ser cacheado por `contactId + templateName` para evitar re-geração
3. WHEN IA falha THEN sistema SHALL usar fallback dos dados diretos do contato (não falhar dispatch)

**Independent Test**: Campanha com aiVariableGeneration → verificar que variáveis geradas diferem por contato.

---

## Edge Cases

- WHEN contato não tem `phone` ou `whatsappPhone` THEN dispatch SHALL falhar com `stopReason: NO_WHATSAPP_PHONE` (não quebrar campanha inteira)
- WHEN template Meta é rejeitado/desativado THEN dispatch SHALL falhar com `stopReason: TEMPLATE_UNAVAILABLE` e pausar campanha
- WHEN tenant deleta campanha com execuções PENDING THEN execuções pendentes SHALL ser marcadas STOPPED
- WHEN `dailyLimit` = 0 THEN sistema SHALL rejeitar ativação da campanha
- WHEN mesmo contato em duas campanhas ativas THEN cooldown e bloqueio aplicam entre campanhas (cross-campaign)
- WHEN webhook Meta chega sem execução correspondente THEN SHALL ser logado e ignorado sem erro 500

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| PROSP-01 | P1: Template message | Design | Pending |
| PROSP-02 | P1: Badge + bloqueio | Design | Pending |
| PROSP-03 | P1: Anti-abuso cooldown/delay | Design | Pending |
| PROSP-04 | P2: Auto-pause block rate | Design | Pending |
| PROSP-05 | P2: Webhook Meta qualidade | Design | Pending |
| PROSP-06 | P3: IA variáveis | Design | Pending |

---

## Success Criteria

- [ ] Campanha de 100 contatos enviada via template aprovado sem erros de política Meta
- [ ] Zero reenvios para contatos já CONTACTED (100% bloqueio)
- [ ] Delay randomizado entre envios: nunca abaixo de `minDelaySeconds`
- [ ] Badge correto para cada status (CONTACTED / RESPONDED / STOPPED) na lista de contatos
- [ ] Auto-pause funciona quando block rate > threshold simulado
- [ ] Webhook Meta processa e marca opt-out em < 5s após recebimento
