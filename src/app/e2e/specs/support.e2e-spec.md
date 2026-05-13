# Módulo: Support

## Rotas Testadas
- `/support`

## Pré-condições
- Usuário autenticado com tenant ativo
- Feedbacks de teste criados (bug, sugestão, melhoria)
- Módulos do app identificáveis para contexto

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/support` | Página carrega com KPIs |
| 1.2 | Verificar lista de feedbacks | Lista visível |
| 1.3 | Verificar botão criar feedback | Botão visível |
| 1.4 | Verificar filtros por tipo | Filtros visíveis |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar feedback tipo "bug" | Feedback criado com tipo correto |
| 2.2 | Criar feedback tipo "sugestão" | Feedback criado |
| 2.3 | Criar feedback tipo "melhoria" | Feedback criado |
| 2.4 | Módulo atual detectado automaticamente | Campo preenchido com módulo corrente |
| 2.5 | Caminho da tela capturado | Path registrado no feedback |
| 2.6 | Visualizar lista de feedbacks | Lista com tipo, data, status |
| 2.7 | Buscar feedback por texto | Resultados corretos |
| 2.8 | Filtrar por tipo (bug/sugestão/melhoria) | Lista filtrada |
| 2.9 | Visualizar KPIs (total, por tipo, resolvidos) | Valores corretos |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar feedback sem descrição | Validação "Descrição obrigatória" |
| 3.2 | Criar feedback sem tipo | Validação "Tipo obrigatório" |
| 3.3 | Descrição com menos de 10 caracteres | Validação de mínimo |
| 3.4 | Descrição com mais de 5000 caracteres | Validação de máximo |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar por "bug" | Apenas bugs |
| 4.2 | Filtrar por "sugestão" | Apenas sugestões |
| 4.3 | Filtrar por "melhoria" | Apenas melhorias |
| 4.4 | Buscar por texto da descrição | Resultados corretos |
| 4.5 | Busca sem resultados | Mensagem "Nenhum feedback encontrado" |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 20+ feedbacks | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: feedback | Persistido |
| 6.2 | Read: detalhes do feedback | Dados completos |
| 6.3 | Update: editar descrição (se permitido) | Dados atualizados |
| 6.4 | Delete: remover feedback (se permitido) | Removido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem feedbacks | Mensagem vazia, CTA criar |
| 7.2 | Loading da lista | Skeletons |
| 7.3 | KPIs zerados | Cards com 0 |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar | Mensagem de erro, form preservado |
| 8.2 | API retorna 500 na listagem | Mensagem de erro, retry |
| 8.3 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS na descrição | HTML escapado |
| 9.2 | SQL injection na busca | Input sanitizado |
| 9.3 | Descrição com 5000 caracteres (limite) | Aceita |
| 9.4 | Feedback com emojis | Aceito e exibido |
| 9.5 | Feedback com apenas espaços | Tratado como vazio |
| 9.6 | Múltiplos feedbacks em sequência rápida | Rate limiting ou aceito |
| 9.7 | Double-click em criar | Apenas um feedback |
| 9.8 | Caracteres unicode extremos | Aceito ou sanitizado |
| 9.9 | Path da tela manipulado | Validação no backend |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Support em mobile (375px) | Layout adaptado |
| 10.2 | Support em tablet (768px) | Layout adaptado |
| 10.3 | Support em desktop (1440px) | Layout completo |
| 10.4 | Navegação por teclado | Focus em campos e botões |
| 10.5 | Screen reader em formulário | Labels anunciados |
| 10.6 | Textarea com aria-describedby | Instruções acessíveis |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Submeter feedback durante navegação | Feedback salvo ou cancelado limpo |
| 11.2 | Double-click no submit | Apenas um feedback |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Qualquer role pode criar feedback | Permitido para todos |
| 12.2 | Feedbacks de outro tenant | Nunca visíveis |
| 12.3 | Feedback não expõe dados internos do sistema | Apenas descrição do usuário |
