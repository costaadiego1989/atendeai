# Módulo: Inventory

## Rotas Testadas
- `/inventory`

## Pré-condições
- Usuário autenticado com tenant ativo
- Produtos cadastrados no catálogo com estoque
- Movimentações de estoque registradas
- Integração de sincronização configurada (se aplicável)

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/inventory` | Página de estoque carrega |
| 1.2 | Verificar listagem de produtos | Tabela com produtos e quantidades |
| 1.3 | Verificar alertas de estoque baixo | Indicadores visuais |
| 1.4 | Verificar campo de busca | Input visível |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Visualizar estoque de todos os produtos | Lista com quantidades atuais |
| 2.2 | Ajuste manual de estoque (entrada) | Quantidade incrementada |
| 2.3 | Ajuste manual de estoque (saída) | Quantidade decrementada |
| 2.4 | Visualizar histórico de movimentações | Lista cronológica |
| 2.5 | Sincronização de estoque | Status atualizado |
| 2.6 | Alerta de estoque baixo | Notificação quando < mínimo |
| 2.7 | Exportar relatório de estoque | Download CSV/PDF |
| 2.8 | Importar ajustes em massa | Upload processado |
| 2.9 | Filtrar por status (normal/baixo/esgotado) | Lista filtrada |
| 2.10 | Buscar produto por nome | Resultados corretos |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Ajuste com quantidade = 0 | Validação impede |
| 3.2 | Ajuste com quantidade negativa (saída > estoque) | Mensagem "Estoque insuficiente" |
| 3.3 | Ajuste sem motivo (se obrigatório) | Validação exige motivo |
| 3.4 | Quantidade com decimal | Validação (apenas inteiros) |
| 3.5 | Quantidade > 999.999 | Validação de limite |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar por "estoque baixo" | Apenas produtos abaixo do mínimo |
| 4.2 | Filtrar por "esgotado" | Apenas produtos com qty = 0 |
| 4.3 | Buscar por nome do produto | Resultados corretos |
| 4.4 | Buscar por SKU | Resultados corretos |
| 4.5 | Filtro + busca combinados | Resultados corretos |
| 4.6 | Limpar filtros | Lista completa |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 50+ produtos | Paginação funcional |
| 5.2 | Histórico com 100+ movimentações | Paginação funcional |
| 5.3 | Navegar entre páginas | Dados corretos |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: ajuste de entrada | Movimentação registrada |
| 6.2 | Read: histórico de movimentações | Dados exibidos |
| 6.3 | Update: editar mínimo de estoque | Valor atualizado |
| 6.4 | Delete: cancelar movimentação (se permitido) | Estoque revertido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem produtos no catálogo | Mensagem "Cadastre produtos primeiro" |
| 7.2 | Sem movimentações | Histórico vazio |
| 7.3 | Loading da lista | Skeletons |
| 7.4 | Sincronização em progresso | Indicador de progresso |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao ajustar | Mensagem de erro, form preservado |
| 8.2 | Sincronização falha | Mensagem de erro, retry |
| 8.3 | Exportação falha | Mensagem de erro |
| 8.4 | Importação com erros | Detalhes das linhas com problema |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Ajuste de 999.999 unidades | Aceito ou limite |
| 9.2 | XSS no campo motivo | HTML escapado |
| 9.3 | SQL injection na busca | Input sanitizado |
| 9.4 | Importação com 10.000+ linhas | Processamento com feedback |
| 9.5 | Ajuste simultâneo do mesmo produto | Consistência garantida |
| 9.6 | Produto deletado do catálogo | Estoque tratado (soft delete) |
| 9.7 | Double-click no ajustar | Apenas um ajuste |
| 9.8 | Estoque = MAX_INT | Sem overflow |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Inventory em mobile (375px) | Tabela scrollável ou cards |
| 10.2 | Inventory em tablet (768px) | Tabela compacta |
| 10.3 | Inventory em desktop (1440px) | Tabela completa |
| 10.4 | Alertas com aria-live | Screen reader anuncia |
| 10.5 | Navegação por teclado | Focus em ações |
| 10.6 | Cores de alerta com contraste | WCAG AA |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois ajustes simultâneos no mesmo produto | Ambos aplicados sequencialmente |
| 11.2 | Venda no checkout reduz estoque enquanto ajusta | Consistência |
| 11.3 | Sincronização durante ajuste manual | Dados consistentes |
| 11.4 | Double-click no confirmar ajuste | Apenas um registro |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver estoque | Leitura permitida |
| 12.2 | Viewer tenta ajustar | Bloqueado |
| 12.3 | Operador pode ajustar estoque | Permitido |
| 12.4 | Estoque de outro tenant | Nunca visível |
| 12.5 | Histórico mostra quem fez ajuste | Auditoria |
