# Módulo: Messaging

## Rotas Testadas
- `/messaging`
- `/messaging/:conversationId`

## Pré-condições
- Usuário autenticado com tenant ativo
- Canal WhatsApp conectado
- Conversas de teste com diferentes status (ativa, arquivada, pendente)
- Agente IA configurado com regras
- Tenant com plano Trial e outro com plano pago (para testes de limite)

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/messaging` | Lista de conversas carrega |
| 1.2 | Verificar KPIs no topo | Cards de métricas visíveis |
| 1.3 | Verificar filtros de status | Filtros visíveis (todas, ativas, pendentes, arquivadas) |
| 1.4 | Verificar campo de busca | Input de busca visível |
| 1.5 | Selecionar uma conversa | Painel de mensagens abre à direita |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Enviar mensagem de texto | Mensagem aparece na conversa com status "enviada" |
| 2.2 | Enviar mensagem com mídia (imagem) | Upload completa, preview exibido |
| 2.3 | Enviar mensagem de áudio | Gravação funciona, áudio enviado |
| 2.4 | Receber mensagem (WebSocket) | Mensagem aparece em tempo real |
| 2.5 | Arquivar conversa | Conversa move para aba "arquivadas" |
| 2.6 | Desarquivar conversa | Conversa volta para aba "ativas" |
| 2.7 | Handoff IA → humano | Conversa transferida, IA para de responder |
| 2.8 | Handoff humano → IA | IA retoma respostas automáticas |
| 2.9 | Buscar conversa por nome do contato | Resultados filtrados |
| 2.10 | Filtrar por status | Lista filtrada corretamente |
| 2.11 | Scroll infinito no histórico | Mensagens antigas carregadas |
| 2.12 | Visualizar status da mensagem (enviada/entregue/lida) | Ícones de status corretos |

### 3. Envio de Mensagem com IA
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | IA responde automaticamente a mensagem recebida | Resposta da IA aparece na conversa com indicador "IA" |
| 3.2 | Toggle de IA ativado na conversa | Auto-reply ativo, IA responde novas mensagens |
| 3.3 | Toggle de IA desativado na conversa | IA não responde, aguarda humano |
| 3.4 | IA respeita regras do agente configuradas | Resposta segue tom/contexto das regras |
| 3.5 | IA com contexto do catálogo | Responde sobre produtos/preços corretamente |
| 3.6 | IA com contexto de agendamento | Sugere horários disponíveis |
| 3.7 | Mensagem da IA com erro (API OpenAI falha) | Fallback: notifica atendente, não envia lixo ao cliente |
| 3.8 | IA responde em menos de 30s | Tempo de resposta aceitável |
| 3.9 | Múltiplas mensagens recebidas em sequência | IA responde cada uma ou agrupa contexto |
| 3.10 | IA não responde conversa já atribuída a humano | Respeita handoff |

### 4. Envio de Mensagem com IA no Plano Trial
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Tenant no plano Trial envia mensagem com IA | IA responde normalmente dentro do limite |
| 4.2 | Verificar limite de mensagens IA no Trial | Contador de uso exibido ou consultável |
| 4.3 | Tenant Trial atinge limite de mensagens IA | Mensagem de limite atingido, sugestão de upgrade |
| 4.4 | Após atingir limite, IA não responde mais | Mensagens ficam sem resposta automática |
| 4.5 | Após atingir limite, humano ainda pode responder | Envio manual funciona normalmente |
| 4.6 | Contador de IA é decrementado corretamente | Cada resposta IA decrementa 1 do limite |
| 4.7 | Contador reseta no próximo ciclo (se aplicável) | Limite renovado conforme regra do plano |
| 4.8 | Upgrade de Trial para plano pago | Limite expandido, IA volta a funcionar |
| 4.9 | Tenant Trial sem créditos IA tenta ativar toggle | Toggle bloqueado ou mensagem de upgrade |
| 4.10 | Exibição do uso restante de IA no painel | Barra de progresso ou contador visível |

### 5. Marcar como Venda Feita (Sale Attribution)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Clicar em "Marcar como venda" na conversa | Dialog de atribuição de venda abre |
| 5.2 | Dialog exige valor da venda (campo obrigatório) | Não permite confirmar sem valor |
| 5.3 | Preencher valor e confirmar venda | Venda registrada com sucesso |
| 5.4 | Venda atribuída ao usuário que atendeu a conversa | Atribuição correta (não ao owner ou outro membro) |
| 5.5 | KPI de vendas do atendente é atualizado | Valor incrementado no dashboard/métricas do usuário |
| 5.6 | Venda aparece no histórico do contato | Timeline do contato mostra evento de venda |
| 5.7 | Venda aparece no relatório de vendas por usuário | Owner vê a venda atribuída ao atendente correto |
| 5.8 | Tentar atribuir venda duplicada na mesma conversa | Confirmação extra "Já existe uma venda nesta conversa, deseja adicionar outra?" |
| 5.9 | Valor da venda com formato inválido (letras) | Validação impede envio |
| 5.10 | Valor da venda com centavos (R$ 99,90) | Aceito e formatado corretamente |
| 5.11 | Valor da venda zero | Validação impede (valor mínimo) |
| 5.12 | Valor da venda negativo | Validação impede |
| 5.13 | Cancelar dialog de venda | Nenhuma venda registrada |
| 5.14 | Conversa atendida por IA (sem humano) marca venda | Atribuição ao último humano que interagiu ou ao owner |
| 5.15 | Múltiplos atendentes na mesma conversa | Venda atribuída ao atendente ativo no momento da marcação |

### 6. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Enviar mensagem vazia | Botão desabilitado |
| 6.2 | Mensagem com apenas espaços | Tratada como vazia |
| 6.3 | Upload de arquivo > limite (25MB) | Mensagem de tamanho máximo |
| 6.4 | Upload de tipo não suportado (.exe) | Mensagem de tipo inválido |

### 7. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Busca por nome do contato | Resultados corretos |
| 7.2 | Busca por número de telefone | Resultados corretos |
| 7.3 | Filtro "ativas" | Apenas conversas ativas |
| 7.4 | Filtro "pendentes" | Apenas conversas aguardando resposta |
| 7.5 | Filtro "arquivadas" | Apenas conversas arquivadas |
| 7.6 | Busca sem resultados | Mensagem "Nenhuma conversa encontrada" |
| 7.7 | Limpar busca | Lista completa restaurada |

### 8. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | Lista com 50+ conversas | Scroll infinito ou paginação |
| 8.2 | Carregar mais conversas ao scrollar | Novas conversas aparecem |
| 8.3 | Histórico de mensagens longo (1000+) | Scroll para cima carrega mais |

### 9. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Tenant sem conversas | Mensagem "Nenhuma conversa ainda" |
| 9.2 | Conversa sem mensagens | Estado vazio no painel |
| 9.3 | Loading da lista | Skeletons |
| 9.4 | Loading de mensagens | Spinner no painel |
| 9.5 | Enviando mensagem | Indicador de envio |

### 10. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | API de conversas retorna 500 | Mensagem de erro, retry |
| 10.2 | Envio de mensagem falha | Mensagem com ícone de erro, botão reenviar |
| 10.3 | Upload de mídia falha | Mensagem de erro, retry |
| 10.4 | WebSocket desconecta | Reconexão automática, indicador visual |
| 10.5 | API de IA retorna 500 | Notificação ao atendente |
| 10.6 | Token expirado durante conversa | Refresh sem perder mensagem digitada |

### 11. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Mensagem com 10.000+ caracteres | Aceita ou truncada com aviso |
| 11.2 | Mensagem com emojis complexos (flags, skin tones) | Renderizada corretamente |
| 11.3 | Mensagem com links longos (500+ chars) | Link truncado visualmente, funcional |
| 11.4 | XSS em mensagem recebida | HTML escapado na renderização |
| 11.5 | Mensagem com caracteres RTL (árabe/hebraico) | Layout não quebra |
| 11.6 | Upload de imagem corrompida | Erro tratado, sem crash |
| 11.7 | Enviar 100 mensagens em sequência rápida | Rate limiting ou fila |
| 11.8 | Conversa com 10.000+ mensagens | Performance aceitável no scroll |
| 11.9 | Áudio de 5+ minutos | Aceito ou limite informado |

### 12. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Messaging em mobile (375px) | Lista ou conversa (não ambos) |
| 12.2 | Voltar da conversa para lista (mobile) | Navegação funcional |
| 12.3 | Messaging em tablet (768px) | Split view ou toggle |
| 12.4 | Messaging em desktop (1440px) | Split view completo |
| 12.5 | Navegação por teclado | Tab entre conversas, Enter abre |
| 12.6 | Screen reader em mensagens | Conteúdo e remetente anunciados |
| 12.7 | Focus no input após selecionar conversa | Auto-focus no campo de texto |

### 13. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 13.1 | Dois atendentes respondem mesma conversa | Ambas mensagens enviadas, ordem preservada |
| 13.2 | Mensagem recebida enquanto digita | Não perde texto digitado |
| 13.3 | Arquivar conversa enquanto outro responde | Conflito tratado |
| 13.4 | Double-click no enviar | Apenas uma mensagem enviada |
| 13.5 | Trocar de conversa durante envio | Mensagem enviada na conversa correta |

### 14. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 14.1 | Viewer pode ver conversas | Leitura permitida |
| 14.2 | Viewer tenta enviar mensagem | Bloqueado ou oculto |
| 14.3 | Acessar conversa de outro tenant | 404 ou 403 |
| 14.4 | Operador pode enviar e arquivar | Ações permitidas |
| 14.5 | Apenas admin/owner pode configurar IA | Toggle oculto para outros |
