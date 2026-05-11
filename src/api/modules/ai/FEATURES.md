# FEATURES - `ai`

## Estado atual

O modulo ja processa respostas de IA, usa contexto de negocio e possui politicas de seguranca/handoff. Ele e central para conversao, produtividade e qualidade percebida no atendimento.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Safety gate com handoff inteligente | parcial | Evita respostas arriscadas e encaminha para humano quando necessario. | Menos respostas bloqueadas indevidamente e menos incidentes de atendimento. |
| P0 | Contexto comercial unificado | parcial | A IA responde com catalogo, agenda, proposta, pagamento e historico sem inventar. | Aumento de respostas resolutivas sem humano em fluxos comerciais. |
| P0 | Score de intencao e urgencia | recomendado | Prioriza leads quentes e conversas que pedem acao imediata. | Aumento de conversoes e reducao de tempo de primeira acao. |
| P1 | Explicacao interna da resposta sugerida | recomendado | O atendente entende por que a IA recomendou aquela resposta. | Maior taxa de aceite de sugestoes pelo time. |
| P2 | Multiplos provedores de LLM configuraveis por tenant | nao recomendado agora | Pode reduzir custo/risco, mas aumenta complexidade operacional. | Priorizar apenas se custo ou disponibilidade virar dor real. |

## Observacao

O maior valor nao e "IA mais criativa"; e IA mais correta, contextual, segura e orientada a acao.
