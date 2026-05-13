# Módulo: Catalog

## Rotas Testadas
- `/catalog`
- `/catalog/products`
- `/catalog/services`

## Pré-condições
- Usuário autenticado com tenant ativo
- Produtos e serviços de teste cadastrados
- Categorias criadas
- Imagens de teste disponíveis para upload

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/catalog` | Página de catálogo carrega |
| 1.2 | Verificar tabs (produtos/serviços) | Tabs visíveis |
| 1.3 | Verificar botão de criar item | Botão visível |
| 1.4 | Verificar campo de busca | Input visível |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar produto com todos os campos | Produto criado, aparece na lista |
| 2.2 | Criar serviço com todos os campos | Serviço criado, aparece na lista |
| 2.3 | Editar produto | Dados atualizados |
| 2.4 | Editar serviço | Dados atualizados |
| 2.5 | Deletar produto | Removido da lista |
| 2.6 | Deletar serviço | Removido da lista |
| 2.7 | Upload de imagem do produto | Imagem salva e exibida |
| 2.8 | Definir preço com formatação BR | R$ 99,90 salvo corretamente |
| 2.9 | Gerenciar estoque | Quantidade atualizada |
| 2.10 | Criar categoria | Categoria criada |
| 2.11 | Associar produto a categoria | Vínculo salvo |
| 2.12 | Buscar item por nome | Resultados corretos |
| 2.13 | Filtrar por categoria | Lista filtrada |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar produto sem nome | Mensagem "Nome obrigatório" |
| 3.2 | Criar produto sem preço | Mensagem "Preço obrigatório" |
| 3.3 | Preço com valor negativo | Validação impede |
| 3.4 | Preço com letras | Validação impede |
| 3.5 | Estoque com valor negativo | Validação impede |
| 3.6 | Estoque com decimal | Validação (apenas inteiros) |
| 3.7 | Nome com mais de 255 caracteres | Validação de tamanho |
| 3.8 | Descrição com mais de 5000 caracteres | Validação de tamanho |
| 3.9 | Imagem > 5MB | Mensagem de tamanho máximo |
| 3.10 | Formato de imagem inválido (.svg, .bmp) | Mensagem de formato |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Buscar por nome parcial | Resultados com match |
| 4.2 | Filtrar por categoria | Itens da categoria |
| 4.3 | Filtrar por disponibilidade (em estoque/esgotado) | Lista filtrada |
| 4.4 | Busca sem resultados | Mensagem "Nenhum item encontrado" |
| 4.5 | Limpar filtros | Lista completa |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 20+ produtos | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |
| 5.3 | Filtro + paginação | Paginação reseta para página 1 |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create produto | Persistido |
| 6.2 | Read produto | Todos os campos exibidos |
| 6.3 | Update produto | Dados atualizados |
| 6.4 | Delete produto | Removido |
| 6.5 | Create serviço | Persistido |
| 6.6 | Read serviço | Todos os campos exibidos |
| 6.7 | Update serviço | Dados atualizados |
| 6.8 | Delete serviço | Removido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem produtos cadastrados | Mensagem vazia, CTA criar |
| 7.2 | Sem serviços cadastrados | Mensagem vazia, CTA criar |
| 7.3 | Loading da lista | Skeletons |
| 7.4 | Upload de imagem em progresso | Progress indicator |
| 7.5 | Produto sem imagem | Placeholder/ícone padrão |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar | Mensagem de erro, form preservado |
| 8.2 | Upload de imagem falha | Mensagem de erro, retry |
| 8.3 | Produto não encontrado (404) | Mensagem "Item não encontrado" |
| 8.4 | Timeout no upload | Mensagem de erro |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS no nome do produto | HTML escapado |
| 9.2 | SQL injection na busca | Input sanitizado |
| 9.3 | Preço R$ 0,00 | Aceito (gratuito) ou validação |
| 9.4 | Preço R$ 999.999,99 | Aceito, formatado |
| 9.5 | Imagem corrompida | Erro tratado |
| 9.6 | Nome com emojis | Aceito e exibido |
| 9.7 | Deletar produto vinculado a pedido | Confirmação ou soft delete |
| 9.8 | Estoque = 0 | Marcado como "esgotado" |
| 9.9 | Múltiplas imagens (se suportado) | Galeria funcional |
| 9.10 | Double-click no criar | Apenas um item criado |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Catálogo em mobile (375px) | Grid 1 coluna ou lista |
| 10.2 | Catálogo em tablet (768px) | Grid 2 colunas |
| 10.3 | Catálogo em desktop (1440px) | Grid 3-4 colunas |
| 10.4 | Imagens com alt text | Screen reader descreve |
| 10.5 | Navegação por teclado | Focus em cards/botões |
| 10.6 | Modal de criação com focus trap | Tab contido |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois usuários editam mesmo produto | Último save ou conflito |
| 11.2 | Deletar produto enquanto outro edita | Conflito tratado |
| 11.3 | Upload de imagem durante edição | Imagem associada corretamente |
| 11.4 | Double-click no deletar | Apenas uma deleção |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver catálogo | Leitura permitida |
| 12.2 | Viewer tenta criar produto | Bloqueado |
| 12.3 | Operador pode gerenciar catálogo | Permitido |
| 12.4 | Produtos de outro tenant | Nunca visíveis |
| 12.5 | URL de imagem de outro tenant | Acesso negado |
