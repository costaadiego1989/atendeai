# Módulo: Contacts

## Rotas Testadas
- `/contacts`
- `/contacts/:id`

## Pré-condições
- Usuário autenticado com tenant ativo
- Contatos de teste criados com diferentes estágios do funil
- Arquivo CSV de teste para importação

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/contacts` | Lista de contatos carrega |
| 1.2 | Verificar presença de filtros | Filtros de estágio e busca visíveis |
| 1.3 | Verificar botão de criar contato | Botão visível e clicável |
| 1.4 | Acessar `/contacts/:id` | Detalhe do contato carrega |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar contato com todos os campos | Contato criado, aparece na lista |
| 2.2 | Criar contato com campos mínimos (nome + telefone) | Contato criado com sucesso |
| 2.3 | Editar contato existente | Dados atualizados corretamente |
| 2.4 | Deletar contato | Contato removido da lista |
| 2.5 | Buscar contato por nome | Resultados filtrados corretamente |
| 2.6 | Buscar contato por telefone | Resultados filtrados corretamente |
| 2.7 | Filtrar por estágio do funil | Lista filtrada pelo estágio |
| 2.8 | Mover contato entre estágios | Estágio atualizado, pipeline reflete |
| 2.9 | Importar CSV válido | Contatos importados, feedback de sucesso |
| 2.10 | Exportar relatório de contatos | Download do arquivo gerado |
| 2.11 | Abrir conversa do contato | Navega para messaging com conversa aberta |
| 2.12 | Visualizar timeline do contato | Eventos ordenados cronologicamente |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar contato sem nome | Mensagem "Nome obrigatório" |
| 3.2 | Criar contato sem telefone | Mensagem "Telefone obrigatório" |
| 3.3 | Telefone com formato inválido | Mensagem de formato inválido |
| 3.4 | Email com formato inválido | Mensagem "Email inválido" |
| 3.5 | CPF/CNPJ inválido | Mensagem de documento inválido |
| 3.6 | Telefone duplicado no mesmo tenant | Mensagem "Contato já existe" |
| 3.7 | Nome com mais de 255 caracteres | Validação de tamanho |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Busca parcial por nome | Resultados com match parcial |
| 4.2 | Busca por telefone com DDD | Encontra contato |
| 4.3 | Busca por telefone sem DDD | Encontra contato |
| 4.4 | Filtro por múltiplos estágios | Contatos de todos os estágios selecionados |
| 4.5 | Limpar filtros | Lista completa restaurada |
| 4.6 | Busca sem resultados | Mensagem "Nenhum contato encontrado" |
| 4.7 | Busca com caracteres especiais | Sem crash, resultados corretos |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com mais de 20 contatos | Paginação visível |
| 5.2 | Navegar para próxima página | Novos contatos carregados |
| 5.3 | Voltar para página anterior | Contatos anteriores exibidos |
| 5.4 | Última página com menos itens | Exibe itens restantes |
| 5.5 | Scroll infinito (se aplicável) | Novos itens carregados ao scrollar |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: contato com todos os campos | Persistido no banco |
| 6.2 | Read: detalhe do contato | Todos os campos exibidos |
| 6.3 | Update: alterar nome e telefone | Dados atualizados |
| 6.4 | Delete: remover contato | Removido da lista e banco |
| 6.5 | Bulk delete: selecionar múltiplos e deletar | Todos removidos |
| 6.6 | Bulk update: mudar estágio de múltiplos | Todos atualizados |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Tenant sem contatos | Mensagem "Nenhum contato", CTA para criar |
| 7.2 | Loading da lista | Skeletons ou spinner |
| 7.3 | Loading do detalhe | Skeleton do perfil |
| 7.4 | Importação em progresso | Progress bar ou status |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API de listagem retorna 500 | Mensagem de erro, retry |
| 8.2 | API de criação retorna 400 | Mensagem com campo inválido |
| 8.3 | API de importação retorna 422 | Detalhes das linhas com erro |
| 8.4 | Contato não encontrado (404) | Mensagem "Contato não encontrado" |
| 8.5 | Timeout na importação de CSV grande | Mensagem de timeout, sugestão de arquivo menor |
| 8.6 | Token expirado durante operação | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | SQL injection no campo busca | Input sanitizado |
| 9.2 | XSS no campo nome: `<img onerror=alert(1)>` | HTML escapado |
| 9.3 | CSV com 10.000+ linhas | Importação com feedback de progresso ou limite |
| 9.4 | CSV com encoding incorreto (Latin1 vs UTF-8) | Caracteres especiais tratados |
| 9.5 | CSV com colunas faltando | Erro detalhado por linha |
| 9.6 | CSV com delimitador errado (tab vs vírgula) | Detecção ou mensagem de formato |
| 9.7 | Telefone com caracteres não numéricos | Sanitização automática ou erro |
| 9.8 | Nome com emojis | Aceito e exibido corretamente |
| 9.9 | Importar mesmo CSV duas vezes | Duplicatas detectadas ou merge |
| 9.10 | Deletar contato com conversa ativa | Confirmação extra ou bloqueio |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Lista em mobile (375px) | Cards empilhados, ações em menu |
| 10.2 | Lista em tablet (768px) | Tabela compacta |
| 10.3 | Lista em desktop (1440px) | Tabela completa |
| 10.4 | Navegação por teclado na lista | Focus em linhas, Enter abre detalhe |
| 10.5 | Screen reader na tabela | Headers e cells anunciados |
| 10.6 | Modal de criação com focus trap | Tab não sai do modal |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois usuários editam mesmo contato | Último save vence ou conflito detectado |
| 11.2 | Deletar contato enquanto outro edita | Mensagem de conflito |
| 11.3 | Importação simultânea de dois CSVs | Ambos processados ou fila |
| 11.4 | Double-click no botão criar | Apenas um contato criado |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer tenta criar contato | Botão oculto ou desabilitado |
| 12.2 | Viewer tenta deletar contato | Ação bloqueada |
| 12.3 | Acessar contato de outro tenant via URL | 404 ou 403 |
| 12.4 | Operador pode criar e editar | Ações permitidas |
| 12.5 | Dados sensíveis (CPF) mascarados para viewer | Exibição parcial |
