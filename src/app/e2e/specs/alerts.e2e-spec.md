# Módulo: Alerts

## Rotas Testadas
- `/alerts`

## Pré-condições
- Usuário autenticado com tenant ativo
- Alertas de teste criados (ativos, pausados)
- Número de telefone configurado para envio
- Horários de envio configurados

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/alerts` | Página carrega com KPIs |
| 1.2 | Verificar lista de alertas | Lista visível |
| 1.3 | Verificar botão criar alerta | Botão visível |
| 1.4 | Verificar filtros | Filtros de status visíveis |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar alerta "uma vez" | Alerta criado com data/hora |
| 2.2 | Criar alerta "diário" | Alerta criado com recorrência |
| 2.3 | Pausar alerta ativo | Status muda para pausado |
| 2.4 | Retomar alerta pausado | Status muda para ativo |
| 2.5 | Deletar alerta | Removido da lista |
| 2.6 | Buscar alerta por nome | Resultados corretos |
| 2.7 | Filtrar por status (ativo/pausado) | Lista filtrada |
| 2.8 | Visualizar KPIs (total, ativos, pausados, enviados) | Valores corretos |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar alerta sem mensagem | Validação "Mensagem obrigatória" |
| 3.2 | Criar alerta sem data | Validação "Data obrigatória" |
| 3.3 | Criar alerta sem horário | Validação "Horário obrigatório" |
| 3.4 | Data no passado | Validação "Data deve ser futura" |
| 3.5 | Horário inválido (25:00) | Validação de formato |
| 3.6 | Mensagem com mais de 1000 caracteres | Validação de tamanho |
| 3.7 | Sem telefone configurado | Mensagem "Configure um telefone primeiro" |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar por "ativo" | Apenas alertas ativos |
| 4.2 | Filtrar por "pausado" | Apenas alertas pausados |
| 4.3 | Buscar por conteúdo da mensagem | Resultados corretos |
| 4.4 | Busca sem resultados | Mensagem "Nenhum alerta encontrado" |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 20+ alertas | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: alerta uma vez | Persistido |
| 6.2 | Create: alerta diário | Persistido |
| 6.3 | Read: detalhes do alerta | Dados completos |
| 6.4 | Update: editar mensagem/horário | Dados atualizados |
| 6.5 | Delete: remover alerta | Removido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem alertas criados | Mensagem vazia, CTA criar |
| 7.2 | Loading da lista | Skeletons |
| 7.3 | KPIs zerados | Cards com 0 |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar | Mensagem de erro |
| 8.2 | API retorna 500 ao pausar | Mensagem de erro |
| 8.3 | Alerta não encontrado (404) | Mensagem "Alerta não encontrado" |
| 8.4 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS na mensagem do alerta | HTML escapado |
| 9.2 | SQL injection na busca | Input sanitizado |
| 9.3 | Criar 100+ alertas | Performance aceitável |
| 9.4 | Alerta para daqui a 1 minuto | Aceito ou mínimo de antecedência |
| 9.5 | Alerta diário com horário 00:00 | Aceito |
| 9.6 | Alerta diário com horário 23:59 | Aceito |
| 9.7 | Double-click em criar | Apenas um alerta criado |
| 9.8 | Pausar e retomar rapidamente | Estado final correto |
| 9.9 | Mensagem com emojis | Aceita e exibida |
| 9.10 | Mensagem com apenas espaços | Tratada como vazia |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Alerts em mobile (375px) | Cards empilhados |
| 10.2 | Alerts em tablet (768px) | Layout adaptado |
| 10.3 | Alerts em desktop (1440px) | Layout completo |
| 10.4 | Navegação por teclado | Focus em ações |
| 10.5 | Screen reader em KPIs | Valores anunciados |
| 10.6 | Date/time picker acessível | Navegável por teclado |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Pausar alerta enquanto está sendo enviado | Envio atual completa, próximo não envia |
| 11.2 | Deletar alerta enquanto está sendo enviado | Envio atual completa |
| 11.3 | Editar alerta enquanto está sendo enviado | Próximo envio usa dados novos |
| 11.4 | Double-click em pausar | Apenas uma operação |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver alertas | Leitura permitida |
| 12.2 | Viewer tenta criar | Bloqueado |
| 12.3 | Operador pode gerenciar alertas | Permitido |
| 12.4 | Alertas de outro tenant | Nunca visíveis |
| 12.5 | Telefone de destino validado | Formato brasileiro |
