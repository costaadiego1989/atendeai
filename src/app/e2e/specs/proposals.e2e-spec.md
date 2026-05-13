# Módulo: Proposals

## Rotas Testadas
- `/proposals`
- `/proposals/:id`
- `/proposals/public/:token` (página pública)

## Pré-condições
- Usuário autenticado com tenant ativo
- Propostas de teste criadas (rascunho, enviada, aceita, rejeitada, expirada)
- Produtos/serviços no catálogo para vincular
- Contatos cadastrados

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/proposals` | Lista de propostas carrega |
| 1.2 | Verificar filtros de status | Filtros visíveis |
| 1.3 | Verificar botão criar proposta | Botão visível |
| 1.4 | Acessar proposta pública com token válido | Página pública carrega |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar proposta com itens | Proposta criada em rascunho |
| 2.2 | Adicionar itens do catálogo | Itens vinculados com preço |
| 2.3 | Aplicar desconto | Valor total atualizado |
| 2.4 | Definir validade | Data de expiração salva |
| 2.5 | Enviar proposta ao cliente | Status muda para "enviada", link gerado |
| 2.6 | Duplicar proposta | Cópia criada em rascunho |
| 2.7 | Editar proposta em rascunho | Dados atualizados |
| 2.8 | Visualização pública da proposta | Cliente vê itens, valores, validade |
| 2.9 | Cliente aceita proposta | Status muda para "aceita" |
| 2.10 | Cliente rejeita proposta | Status muda para "rejeitada" |
| 2.11 | Exportar proposta em PDF | Download do PDF |
| 2.12 | Proposta expira automaticamente | Status muda para "expirada" |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar proposta sem cliente | Validação "Cliente obrigatório" |
| 3.2 | Criar proposta sem itens | Validação "Adicione ao menos um item" |
| 3.3 | Item com quantidade 0 | Validação de mínimo |
| 3.4 | Desconto > 100% | Validação impede |
| 3.5 | Desconto negativo | Validação impede |
| 3.6 | Validade no passado | Validação impede |
| 3.7 | Preço unitário negativo | Validação impede |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar por status (rascunho/enviada/aceita/rejeitada/expirada) | Lista filtrada |
| 4.2 | Buscar por nome do cliente | Resultados corretos |
| 4.3 | Buscar por número da proposta | Resultados corretos |
| 4.4 | Filtro + busca combinados | Resultados corretos |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 20+ propostas | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: nova proposta | Persistida |
| 6.2 | Read: detalhe da proposta | Todos os campos |
| 6.3 | Update: editar rascunho | Dados atualizados |
| 6.4 | Delete: remover proposta | Removida |
| 6.5 | Editar proposta já enviada | Bloqueado ou cria nova versão |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem propostas | Mensagem vazia, CTA criar |
| 7.2 | Loading da lista | Skeletons |
| 7.3 | Loading do PDF | Spinner |
| 7.4 | Proposta sem itens (rascunho) | Mensagem "Adicione itens" |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar | Mensagem de erro, form preservado |
| 8.2 | Envio de proposta falha | Mensagem de erro |
| 8.3 | PDF generation falha | Mensagem de erro |
| 8.4 | Proposta não encontrada (404) | Mensagem "Proposta não encontrada" |
| 8.5 | Token público inválido | Mensagem "Proposta não encontrada" |
| 8.6 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Proposta com 100+ itens | Performance aceitável |
| 9.2 | XSS no nome do item | HTML escapado |
| 9.3 | Valor total > R$ 1.000.000 | Formatado corretamente |
| 9.4 | Desconto que zera o valor | Aceito (proposta gratuita) ou bloqueio |
| 9.5 | Duplicar proposta com itens deletados do catálogo | Tratamento gracioso |
| 9.6 | Aceitar proposta expirada via URL manipulation | Bloqueado no backend |
| 9.7 | Double-click em enviar | Apenas um envio |
| 9.8 | Proposta com observações de 10.000+ caracteres | Aceito ou limite |
| 9.9 | Cliente acessa proposta de outro tenant | Apenas via token válido |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Proposals em mobile (375px) | Cards ou lista compacta |
| 10.2 | Proposals em tablet (768px) | Layout adaptado |
| 10.3 | Proposals em desktop (1440px) | Tabela completa |
| 10.4 | Página pública em mobile | Layout responsivo |
| 10.5 | Navegação por teclado | Focus em ações |
| 10.6 | PDF acessível | Texto selecionável |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois usuários editam mesma proposta | Conflito detectado |
| 11.2 | Cliente aceita enquanto vendedor edita | Estado final consistente |
| 11.3 | Enviar proposta enquanto outro deleta | Conflito tratado |
| 11.4 | Double-click em aceitar (cliente) | Apenas uma ação |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver propostas | Leitura permitida |
| 12.2 | Viewer tenta criar | Bloqueado |
| 12.3 | Operador pode criar e enviar | Permitido |
| 12.4 | Propostas de outro tenant | Nunca visíveis |
| 12.5 | Token público não expõe dados internos | Apenas dados da proposta |
