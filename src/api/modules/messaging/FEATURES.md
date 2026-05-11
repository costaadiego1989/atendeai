# FEATURES - `messaging`

## Estado atual

O modulo e o centro do atendimento: webhooks, inbox, conversas, envio humano/IA, provedores, filas, follow-up e eventos comerciais. Ele define a experiencia percebida pelo cliente final.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Inbox omnichannel confiavel | parcial | Time atende WhatsApp/Instagram com historico unico. | Mensagens entram sem duplicidade e com ordenacao consistente. |
| P0 | Handoff humano claro | parcial | IA para quando precisa, humano assume sem perder contexto. | Menos conversas abandonadas por resposta automatica inadequada. |
| P0 | SLA e saude dos provedores | recomendado | Dono sabe se falha e da plataforma ou do provedor externo. | Incidentes mostram provedor, fila e ultima entrega. |
| P1 | Opt-out centralizado | parcial | Respeita LGPD/compliance e evita mensagens indesejadas. | Contatos opt-out nao recebem outbound automatico. |
| P1 | Resumo automatico da conversa | recomendado | Atendente entra rapido no contexto. | Tempo de handoff humano diminui. |

## Observacao

Messaging e modulo critico. Valor real aqui e confiabilidade, contexto e velocidade, nao apenas mais canais.
