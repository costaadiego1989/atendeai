# FEATURES - `billing`

## Estado atual

O modulo controla planos, assinaturas, quotas, uso, mudanca de plano e eventos de billing. Ele impacta receita diretamente e evita surpresa de consumo para o cliente.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Alertas de quota antes do bloqueio | parcial | Cliente sabe quando esta perto do limite e evita interrupcao. | Alertas enviados em 70/90/100 por cento de uso configurado. |
| P0 | Upgrade contextual dentro do fluxo bloqueado | recomendado | Cliente destrava uso no momento de necessidade real. | Aumento da conversao de upgrade apos quota atingida. |
| P0 | Painel de consumo por modulo | parcial | Dono entende o que consome mais e toma decisao de plano. | Reducao de tickets sobre cobranca/limite. |
| P1 | Previsao de fim de quota | recomendado | Ajuda a planejar upgrade antes da interrupcao. | Usuario ve data estimada de esgotamento com base no ritmo atual. |
| P2 | Marketplace de add-ons granulares | nao recomendado agora | Pode gerar receita, mas aumenta complexidade comercial. | Priorizar apos consolidar planos e limites principais. |

## Observacao

Billing deve parecer justo e previsivel. Bloqueios sem contexto reduzem confianca e retencao.
