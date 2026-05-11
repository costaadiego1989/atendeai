# FEATURES - `agent-rules`

## Estado atual

O modulo permite configurar regras do agente por tenant, com suporte a rascunho, preview, historico e impacto. Ele ja gera valor porque reduz comportamento generico da IA e aproxima as respostas da operacao real do negocio.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Publicacao versionada com rollback | parcial | O dono pode ajustar a IA sem medo de quebrar o atendimento. | Toda regra publicada tem versao, autor, data e rollback em ate 1 clique. |
| P0 | Preview com impacto em conversas reais anonimizadas | parcial | Antes de publicar, o time ve como a regra muda respostas importantes. | Reducao de alteracoes revertidas e aprovacao antes da publicacao. |
| P1 | Biblioteca de regras por nicho | recomendado | Cliente novo ativa boas praticas rapidamente sem escrever tudo do zero. | Tempo medio para configurar IA cai e uso de templates cresce. |
| P1 | Alerta de regra conflitante | recomendado | Evita instrucoes duplicadas ou contraditorias que pioram a IA. | Menos handoffs por resposta inconsistente apos mudancas. |
| P2 | A/B de regras do agente | nao recomendado agora | Pode otimizar conversao, mas exige volume e metricas maduras. | So priorizar quando houver metricas confiaveis por resposta. |

## Observacao

O modulo nao deve virar editor complexo. O maior valor esta em seguranca operacional: testar, publicar, auditar e voltar atras.
