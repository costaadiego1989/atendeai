# Módulo: Agent Rules

## Rotas Testadas
- Componente inline via `ModuleAgentRuleButton` em diversos módulos
- Modal/drawer de regras do agente

## Pré-condições
- Usuário autenticado como owner ou admin
- Módulo de IA ativo no tenant
- Regras de agente existentes (ativas e inativas)
- Módulos com botão de regras configurado

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Botão de regras visível no módulo messaging | Botão renderizado |
| 1.2 | Botão de regras visível no módulo scheduling | Botão renderizado |
| 1.3 | Clicar no botão abre modal/drawer | Modal carrega com regras |
| 1.4 | Verificar lista de regras do módulo | Regras listadas |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Abrir regras do agente por módulo | Regras do módulo específico exibidas |
| 2.2 | Criar nova regra | Regra criada, aparece na lista |
| 2.3 | Editar regra existente | Dados atualizados |
| 2.4 | Ativar regra | Status muda para ativo |
| 2.5 | Desativar regra | Status muda para inativo |
| 2.6 | Definir prioridade da regra | Ordem atualizada |
| 2.7 | Deletar regra | Removida da lista |
| 2.8 | Reordenar regras (drag & drop ou setas) | Ordem persistida |
| 2.9 | Visualizar preview da regra | Prompt exibido formatado |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar regra sem nome | Validação "Nome obrigatório" |
| 3.2 | Criar regra sem prompt | Validação "Prompt obrigatório" |
| 3.3 | Prompt com mais de 10.000 caracteres | Validação de tamanho |
| 3.4 | Nome duplicado no mesmo módulo | Mensagem de duplicidade |
| 3.5 | Prioridade com valor inválido | Validação |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar regras por status (ativa/inativa) | Lista filtrada |
| 4.2 | Buscar regra por nome | Resultados corretos |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Módulo com 20+ regras | Scroll ou paginação |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: nova regra | Persistida |
| 6.2 | Read: detalhes da regra | Prompt e config exibidos |
| 6.3 | Update: editar prompt | Dados atualizados |
| 6.4 | Delete: remover regra | Removida |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Módulo sem regras | Mensagem "Nenhuma regra", CTA criar |
| 7.2 | Loading das regras | Spinner no modal |
| 7.3 | IA desativada no tenant | Mensagem "Ative a IA primeiro" |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar | Mensagem de erro, form preservado |
| 8.2 | API retorna 500 ao listar | Mensagem de erro no modal |
| 8.3 | Regra não encontrada (404) | Mensagem de erro |
| 8.4 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Prompt com injection: "Ignore previous instructions" | Salvo como texto, não executado como instrução |
| 9.2 | XSS no nome da regra | HTML escapado |
| 9.3 | Prompt com 10.000 caracteres (limite) | Aceito |
| 9.4 | Regra com caracteres unicode/emojis | Aceito |
| 9.5 | Ativar/desativar rapidamente | Estado final correto |
| 9.6 | Criar regra em módulo inexistente (URL hack) | Erro tratado |
| 9.7 | Double-click em criar | Apenas uma regra |
| 9.8 | Prompt com markdown/code blocks | Salvo e exibido corretamente |
| 9.9 | Reordenar com drag durante loading | Sem crash |
| 9.10 | 50+ regras no mesmo módulo | Performance aceitável |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Modal em mobile (375px) | Fullscreen ou adaptado |
| 10.2 | Modal em tablet (768px) | Tamanho adequado |
| 10.3 | Modal em desktop (1440px) | Tamanho padrão |
| 10.4 | Focus trap no modal | Tab contido |
| 10.5 | Fechar com Escape | Modal fecha |
| 10.6 | Screen reader no formulário | Labels anunciados |
| 10.7 | Drag & drop com alternativa de teclado | Setas up/down |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois admins editam mesma regra | Último save ou conflito |
| 11.2 | Deletar regra enquanto IA está usando | Próxima execução não usa |
| 11.3 | Reordenar enquanto outro cria | Ordem consistente |
| 11.4 | Double-click em ativar/desativar | Apenas uma operação |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Apenas owner/admin pode gerenciar regras | Botão oculto para outros |
| 12.2 | Operador vê botão mas não pode editar | Visualização apenas |
| 12.3 | Viewer não vê botão de regras | Oculto |
| 12.4 | Regras de outro tenant | Nunca acessíveis |
| 12.5 | Prompt não exposto em responses públicas | Apenas interno |
