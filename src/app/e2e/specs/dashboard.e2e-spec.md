# Módulo: Dashboard

## Rotas Testadas
- `/dashboard`

## Pré-condições
- Usuário autenticado com tenant ativo
- Dados de KPIs populados (conversas, vendas, contatos, agendamentos)
- Período padrão: últimos 7 dias

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/dashboard` autenticado | Página carrega com cards de KPIs |
| 1.2 | Verificar presença de gráficos | Gráficos renderizados sem erro |
| 1.3 | Verificar menu lateral | Navegação visível com módulos |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Visualizar KPIs principais | Cards com valores numéricos corretos |
| 2.2 | Alterar período para 30 dias | KPIs atualizados com dados do período |
| 2.3 | Alterar período para 90 dias | KPIs atualizados com dados do período |
| 2.4 | Clicar em card de KPI | Navega para módulo correspondente |
| 2.5 | Visualizar gráfico de conversas | Gráfico com dados do período selecionado |
| 2.6 | Visualizar gráfico de vendas | Gráfico com dados do período selecionado |
| 2.7 | Refresh manual dos dados | Dados recarregados com loading state |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Seleção de período customizado com data futura | Não permite seleção |
| 3.2 | Data início maior que data fim | Validação impede seleção |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtro por período 7d | Dados filtrados corretamente |
| 4.2 | Filtro por período 30d | Dados filtrados corretamente |
| 4.3 | Filtro por período 90d | Dados filtrados corretamente |
| 4.4 | Filtro por período customizado | Dados filtrados pelo range selecionado |

### 5. Paginação
N/A para este módulo.

### 6. CRUD Completo
N/A para este módulo (dashboard é read-only).

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Tenant novo sem dados | Cards com valor 0, gráficos vazios com mensagem |
| 7.2 | Loading inicial | Skeletons nos cards e gráficos |
| 7.3 | Período sem dados | Mensagem "Sem dados para o período" |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API de KPIs retorna 500 | Mensagem de erro, botão retry |
| 8.2 | API de gráficos retorna 500 | Gráfico com estado de erro |
| 8.3 | Timeout na requisição | Mensagem de timeout, retry |
| 8.4 | API retorna 401 (token expirado) | Refresh token ou redirect login |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | KPI com valor muito grande (999.999.999) | Formatação correta sem overflow |
| 9.2 | Gráfico com muitos data points (365 dias) | Renderiza sem travar |
| 9.3 | Múltiplos refreshes rápidos | Debounce, sem requisições duplicadas |
| 9.4 | Manipular query params do período | Validação server-side, sem crash |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Dashboard em mobile (375px) | Cards empilhados, gráficos scrolláveis |
| 10.2 | Dashboard em tablet (768px) | Grid 2 colunas |
| 10.3 | Dashboard em desktop (1440px) | Grid completo |
| 10.4 | Gráficos com aria-labels | Dados acessíveis por screen reader |
| 10.5 | Navegação por teclado nos cards | Focus visível, Enter navega |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Trocar período rapidamente múltiplas vezes | Apenas último resultado exibido |
| 11.2 | Navegar para outro módulo durante loading | Requisição cancelada, sem memory leak |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Usuário viewer acessa dashboard | Visualiza dados (read-only) |
| 12.2 | Dados de outro tenant | Nunca exibidos (multi-tenancy) |
| 12.3 | Token expirado durante visualização | Refresh automático ou redirect |
