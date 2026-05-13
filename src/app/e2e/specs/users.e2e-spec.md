# Módulo: Users (Team)

## Rotas Testadas
- `/team`
- `/team/invite`

## Pré-condições
- Usuário autenticado como owner ou admin do tenant
- Membros do time existentes com diferentes roles
- Convites pendentes de teste

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/team` | Lista de membros carrega |
| 1.2 | Verificar botão convidar | Botão visível |
| 1.3 | Verificar roles exibidos | Roles visíveis por membro |
| 1.4 | Verificar convites pendentes | Lista de convites |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Listar membros do time | Lista com nome, email, role, status |
| 2.2 | Convidar novo usuário | Convite enviado por email |
| 2.3 | Editar permissões de membro | Role atualizado |
| 2.4 | Remover membro do time | Membro removido |
| 2.5 | Reenviar convite pendente | Email reenviado |
| 2.6 | Cancelar convite pendente | Convite removido |
| 2.7 | Alterar role: admin → operador | Role atualizado |
| 2.8 | Alterar role: operador → viewer | Role atualizado |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Convidar sem email | Validação "Email obrigatório" |
| 3.2 | Email inválido | Validação "Email inválido" |
| 3.3 | Email já cadastrado no tenant | Mensagem "Usuário já é membro" |
| 3.4 | Convidar sem selecionar role | Validação "Role obrigatório" |
| 3.5 | Email com mais de 255 caracteres | Validação de tamanho |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Buscar membro por nome | Resultados corretos |
| 4.2 | Buscar membro por email | Resultados corretos |
| 4.3 | Filtrar por role | Lista filtrada |
| 4.4 | Busca sem resultados | Mensagem "Nenhum membro encontrado" |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Time com 20+ membros | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: convidar membro | Convite enviado |
| 6.2 | Read: ver detalhes do membro | Dados exibidos |
| 6.3 | Update: alterar role | Role atualizado |
| 6.4 | Delete: remover membro | Removido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Time com apenas o owner | Lista com 1 membro, CTA convidar |
| 7.2 | Sem convites pendentes | Seção oculta ou vazia |
| 7.3 | Loading da lista | Skeletons |
| 7.4 | Enviando convite | Spinner no botão |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao convidar | Mensagem de erro |
| 8.2 | Email de convite falha | Mensagem de erro |
| 8.3 | Limite de membros atingido | Mensagem "Limite do plano atingido" |
| 8.4 | Token expirado | Refresh ou redirect |
| 8.5 | Convite expirado ao aceitar | Mensagem "Convite expirado" |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS no campo email | HTML escapado |
| 9.2 | SQL injection na busca | Input sanitizado |
| 9.3 | Último admin tenta se remover | Bloqueado "Deve haver ao menos um admin" |
| 9.4 | Owner tenta se remover | Bloqueado |
| 9.5 | Convidar email do próprio usuário | Mensagem "Você já é membro" |
| 9.6 | Convite para email de outro tenant | Permitido (usuário pode estar em múltiplos tenants) |
| 9.7 | Double-click em convidar | Apenas um convite |
| 9.8 | Remover membro com conversas ativas | Confirmação extra |
| 9.9 | Alterar role do owner | Bloqueado |
| 9.10 | Convidar 50 membros (limite do plano) | Mensagem de limite |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Team em mobile (375px) | Cards empilhados |
| 10.2 | Team em tablet (768px) | Tabela compacta |
| 10.3 | Team em desktop (1440px) | Tabela completa |
| 10.4 | Navegação por teclado | Focus em ações |
| 10.5 | Screen reader na tabela | Headers e cells anunciados |
| 10.6 | Select de role acessível | Navegável por teclado |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois admins removem mesmo membro | Apenas uma remoção |
| 11.2 | Alterar role enquanto membro está logado | Sessão atualizada |
| 11.3 | Aceitar convite expirado | Mensagem de expiração |
| 11.4 | Double-click em remover | Apenas uma operação |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Apenas owner/admin pode convidar | Botão oculto para outros |
| 12.2 | Apenas owner/admin pode remover | Ação bloqueada para outros |
| 12.3 | Operador não pode alterar roles | Ação bloqueada |
| 12.4 | Viewer não pode gerenciar time | Apenas visualização |
| 12.5 | Membros de outro tenant | Nunca visíveis |
| 12.6 | Admin não pode alterar role do owner | Bloqueado |
