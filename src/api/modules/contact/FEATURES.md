# FEATURES - `contact`

## Estado atual

O modulo oferece CRM leve com contatos, identificacao, estagios, timeline, importacao e relatorios. Ele cria memoria operacional para atendimento, vendas e recuperacao.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Timeline 360 do cliente | parcial | Atendente entende historico sem perguntar tudo de novo. | Tempo medio de atendimento cai em contatos recorrentes. |
| P0 | Deduplicacao por telefone/email/documento | parcial | Evita historico fragmentado e mensagens duplicadas. | Queda em contatos duplicados apos importacoes e webhooks. |
| P0 | Segmentacao acionavel | recomendado | Permite campanhas e follow-ups por perfil real. | Campanhas usam segmentos e geram maior resposta. |
| P1 | Importacao com preview e erros claros | parcial | Cliente corrige planilha sem suporte manual. | Menos tickets sobre importacao de contatos. |
| P2 | Score de relacionamento | recomendado | Ajuda priorizacao, mas depende de dados historicos bons. | Score correlaciona com conversao ou risco de churn. |

## Observacao

Contato e fonte de verdade do relacionamento. O valor e alto quando os outros modulos leem e escrevem nele de forma consistente.
