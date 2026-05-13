# Módulo: Scheduling

## Rotas Testadas
- `/scheduling`

## Pré-condições
- Usuário autenticado com tenant ativo
- Profissionais e categorias de serviço cadastrados
- Google Calendar conectado (para testes de integração)
- Agendamentos de teste criados

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/scheduling` | Página carrega com overview cards |
| 1.2 | Verificar tabs (profissionais/categorias) | Tabs visíveis e clicáveis |
| 1.3 | Verificar card Google Calendar | Card de integração visível |
| 1.4 | Verificar botão de relatório | Botão acessível |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar profissional com dados válidos | Profissional criado, aparece na lista |
| 2.2 | Editar profissional | Dados atualizados |
| 2.3 | Deletar profissional | Removido da lista |
| 2.4 | Criar categoria de serviço | Categoria criada |
| 2.5 | Editar categoria | Dados atualizados |
| 2.6 | Deletar categoria | Removida da lista |
| 2.7 | Visualizar overview cards (agendamentos do dia) | Dados corretos |
| 2.8 | Gerar relatório com período | Relatório gerado com dados |
| 2.9 | Exportar CSV de agendamentos | Download do arquivo |
| 2.10 | Conectar Google Calendar | Fluxo OAuth completo |
| 2.11 | Sincronizar agendamentos com Google Calendar | Eventos sincronizados |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar profissional sem nome | Mensagem "Nome obrigatório" |
| 3.2 | Criar categoria sem nome | Mensagem "Nome obrigatório" |
| 3.3 | Duração do serviço = 0 | Validação de valor mínimo |
| 3.4 | Preço negativo | Validação impede |
| 3.5 | Horário de início > horário de fim | Validação de intervalo |
| 3.6 | Nome duplicado de profissional | Mensagem de duplicidade |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar relatório por período (7d/30d/90d) | Dados filtrados |
| 4.2 | Filtrar por profissional | Agendamentos do profissional |
| 4.3 | Filtrar por categoria | Agendamentos da categoria |
| 4.4 | Buscar profissional por nome | Resultados corretos |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista de profissionais com 20+ itens | Paginação funcional |
| 5.2 | Lista de categorias com 20+ itens | Paginação funcional |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create profissional | Persistido |
| 6.2 | Read profissional | Dados exibidos |
| 6.3 | Update profissional | Dados atualizados |
| 6.4 | Delete profissional | Removido |
| 6.5 | Create categoria | Persistida |
| 6.6 | Read categoria | Dados exibidos |
| 6.7 | Update categoria | Dados atualizados |
| 6.8 | Delete categoria | Removida |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem profissionais cadastrados | Mensagem vazia, CTA criar |
| 7.2 | Sem categorias cadastradas | Mensagem vazia, CTA criar |
| 7.3 | Sem agendamentos no período | Relatório vazio |
| 7.4 | Loading de dados | Skeletons |
| 7.5 | Google Calendar não conectado | Card com CTA de conexão |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar profissional | Mensagem de erro |
| 8.2 | Google Calendar OAuth falha | Mensagem de erro, retry |
| 8.3 | Sincronização falha | Notificação de erro |
| 8.4 | Timeout no relatório | Mensagem, sugestão de período menor |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Nome de profissional com 500+ caracteres | Validação de tamanho |
| 9.2 | XSS no nome da categoria | HTML escapado |
| 9.3 | Conflito de horário entre agendamentos | Alerta de conflito |
| 9.4 | Agendamento no passado | Bloqueado ou aviso |
| 9.5 | Deletar profissional com agendamentos futuros | Confirmação extra |
| 9.6 | Deletar categoria vinculada a profissional | Bloqueio ou confirmação |
| 9.7 | Preço com muitas casas decimais | Arredondamento para 2 casas |
| 9.8 | Duração de serviço = 1440 min (24h) | Aceito ou limite |
| 9.9 | Múltiplos profissionais com mesmo horário | Permitido (profissionais diferentes) |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Scheduling em mobile (375px) | Cards empilhados, tabs funcionais |
| 10.2 | Scheduling em tablet (768px) | Layout adaptado |
| 10.3 | Scheduling em desktop (1440px) | Layout completo |
| 10.4 | Navegação por teclado | Focus em tabs e botões |
| 10.5 | Screen reader em cards | Dados anunciados |
| 10.6 | Modal de criação com focus trap | Tab contido no modal |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois usuários criam agendamento no mesmo horário | Conflito detectado |
| 11.2 | Editar profissional enquanto outro deleta | Conflito tratado |
| 11.3 | Double-click no criar | Apenas um registro criado |
| 11.4 | Sincronização Google Calendar durante edição | Dados consistentes |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer acessa scheduling | Leitura apenas |
| 12.2 | Viewer tenta criar profissional | Bloqueado |
| 12.3 | Operador pode gerenciar agendamentos | Permitido |
| 12.4 | Dados de outro tenant | Nunca visíveis |
| 12.5 | Google Calendar de outro tenant | Isolamento garantido |
