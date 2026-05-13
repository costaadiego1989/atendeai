# Módulo: Sales

## Rotas Testadas
- `/sales/metrics`
- `/sales/payment-links`
- `/sales/promotions`
- `/sales/report/users` **(NOVA — owner-only)**

## Pré-condições
- Usuário autenticado com tenant ativo
- Vendas registradas (via messaging sale attribution)
- Payment links criados
- Promoções e cupons configurados
- Múltiplos membros do time com vendas atribuídas

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/sales/metrics` | Página de métricas carrega |
| 1.2 | Acessar `/sales/payment-links` | Lista de payment links carrega |
| 1.3 | Acessar `/sales/promotions` | Página de promoções carrega |
| 1.4 | Acessar `/sales/report/users` como owner | Página de relatório por usuário carrega |
| 1.5 | Verificar KPIs de vendas | Cards com valores |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Visualizar métricas com range 7d | Dados dos últimos 7 dias |
| 2.2 | Visualizar métricas com range 30d | Dados dos últimos 30 dias |
| 2.3 | Visualizar métricas com range 90d | Dados dos últimos 90 dias |
| 2.4 | Funil dinâmico de vendas | Etapas com valores corretos |
| 2.5 | Checkouts recentes | Lista com últimos checkouts |
| 2.6 | Criar payment link | Link criado com URL copiável |
| 2.7 | Copiar payment link | URL copiada para clipboard |
| 2.8 | Pausar payment link | Status atualizado para pausado |
| 2.9 | Resumir payment link | Status atualizado para ativo |
| 2.10 | Deletar payment link | Removido da lista |
| 2.11 | Habilitar recebimentos (bootstrap financeiro) | Fluxo de onboarding financeiro |
| 2.12 | Criar promoção | Promoção criada |
| 2.13 | Criar cupom de desconto | Cupom criado com código |
| 2.14 | Editar promoção | Dados atualizados |
| 2.15 | Deletar promoção | Removida |

### 3. Relatório de Vendas por Usuário (Owner-Only)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Owner acessa página de relatório | Página carrega com lista de membros do time |
| 3.2 | Listagem exibe resumo por usuário | Nome, total vendas, valor total, pendente, concluído |
| 3.3 | Clicar em usuário abre modal de detalhes | Modal com dados completos do mês |
| 3.4 | Modal exibe: total de vendas do mês | Valor correto |
| 3.5 | Modal exibe: valor total recebido | Soma dos pagamentos confirmados |
| 3.6 | Modal exibe: valor pendente | Soma dos pagamentos não confirmados |
| 3.7 | Modal exibe: ticket médio | Total / quantidade de vendas |
| 3.8 | Modal exibe: quantidade de vendas | Número correto |
| 3.9 | Modal exibe: lista de vendas individuais | Cada venda com data, valor, contato, status |
| 3.10 | Filtrar por mês atual | Dados do mês corrente |
| 3.11 | Filtrar por mês anterior | Dados do mês passado |
| 3.12 | Filtrar por últimos 3 meses | Dados agregados |
| 3.13 | Filtrar por range customizado | Dados do período selecionado |
| 3.14 | Exportar relatório em CSV | Download com dados de todos os usuários |
| 3.15 | Exportar relatório em PDF | Download formatado |
| 3.16 | Dados consistentes com vendas atribuídas no messaging | Valores batem com "marcar como venda feita" |
| 3.17 | Usuário sem vendas no período | Exibe zeros, não oculta o usuário |
| 3.18 | Usuário removido do time com vendas históricas | Aparece no relatório com indicador "removido" |
| 3.19 | Ordenar por total de vendas | Ordenação correta (desc/asc) |
| 3.20 | Ordenar por quantidade de vendas | Ordenação correta |

### 4. Acesso Restrito ao Relatório (Permissões)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Owner acessa `/sales/report/users` | Acesso permitido, dados carregam |
| 4.2 | Admin acessa `/sales/report/users` | 403 Forbidden ou redirect |
| 4.3 | Operador acessa `/sales/report/users` | 403 Forbidden ou redirect |
| 4.4 | Viewer acessa `/sales/report/users` | 403 Forbidden ou redirect |
| 4.5 | Usuário não-owner tenta acessar via URL direta | Bloqueado |
| 4.6 | Menu lateral mostra link apenas para owner | Link oculto para outros roles |
| 4.7 | API de relatório valida role no backend | Retorna 403 para não-owner |

### 5. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Criar payment link sem valor | Validação "Valor obrigatório" |
| 5.2 | Criar payment link com valor negativo | Validação impede |
| 5.3 | Criar promoção sem nome | Validação "Nome obrigatório" |
| 5.4 | Cupom com código duplicado | Mensagem de duplicidade |
| 5.5 | Desconto > 100% | Validação impede |
| 5.6 | Data de expiração no passado | Validação impede |

### 6. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Filtrar payment links por status (ativo/pausado) | Lista filtrada |
| 6.2 | Filtrar por origem | Lista filtrada |
| 6.3 | Buscar payment link por nome | Resultados corretos |
| 6.4 | Buscar promoção por nome | Resultados corretos |
| 6.5 | Filtrar métricas por período | Dados atualizados |

### 7. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Lista de payment links com 20+ itens | Paginação funcional |
| 7.2 | Lista de promoções com 20+ itens | Paginação funcional |
| 7.3 | Relatório com 50+ membros do time | Paginação ou scroll |

### 8. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | Sem vendas registradas | Métricas zeradas, mensagem informativa |
| 8.2 | Sem payment links | Mensagem vazia, CTA criar |
| 8.3 | Sem promoções | Mensagem vazia, CTA criar |
| 8.4 | Relatório sem vendas no período | Todos os usuários com zeros |
| 8.5 | Loading de métricas | Skeletons nos cards |
| 8.6 | Loading do modal de detalhes | Spinner no modal |

### 9. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | API de métricas retorna 500 | Mensagem de erro, retry |
| 9.2 | API de payment links retorna 500 | Mensagem de erro |
| 9.3 | Criar payment link falha | Mensagem de erro, form preservado |
| 9.4 | API de relatório retorna 500 | Mensagem de erro, retry |
| 9.5 | Exportar CSV falha | Mensagem de erro |
| 9.6 | Token expirado | Refresh ou redirect |

### 10. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Payment link com valor R$ 0,01 | Aceito |
| 10.2 | Payment link com valor R$ 999.999,99 | Aceito, formatado |
| 10.3 | Nome de promoção com XSS | HTML escapado |
| 10.4 | Código de cupom com caracteres especiais | Sanitizado ou rejeitado |
| 10.5 | Relatório com período de 1 ano | Performance aceitável |
| 10.6 | Usuário com 1000+ vendas no período | Modal carrega sem travar |
| 10.7 | Valores em R$ com formatação brasileira | Correto (R$ 1.234,56) |
| 10.8 | Double-click em criar payment link | Apenas um criado |
| 10.9 | Copiar link em navegador sem clipboard API | Fallback funcional |

### 11. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Sales em mobile (375px) | Cards empilhados, tabelas scrolláveis |
| 11.2 | Sales em tablet (768px) | Layout adaptado |
| 11.3 | Sales em desktop (1440px) | Layout completo |
| 11.4 | Modal de relatório em mobile | Fullscreen ou adaptado |
| 11.5 | Navegação por teclado | Focus em botões e links |
| 11.6 | Screen reader em métricas | Valores anunciados |
| 11.7 | Modal com focus trap | Tab contido |
| 11.8 | Fechar modal com Escape | Modal fecha |

### 12. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Pausar e resumir link rapidamente | Estado final correto |
| 12.2 | Dois owners acessam relatório simultaneamente | Ambos veem dados corretos |
| 12.3 | Venda atribuída enquanto relatório está aberto | Refresh mostra novo dado |
| 12.4 | Double-click em deletar | Apenas uma deleção |
| 12.5 | Trocar período do relatório rapidamente | Último resultado exibido |
