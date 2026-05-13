# Módulo: Recovery

## Rotas Testadas
- `/recovery`
- `/recovery/:caseId`

## Pré-condições
- Usuário autenticado com tenant ativo
- Casos de recuperação criados (carteira aberta, promessas, pagos)
- Playbooks configurados
- Contatos com dívidas pendentes

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/recovery` | Página carrega com KPIs |
| 1.2 | Verificar KPIs (carteira aberta, promessas, pagos, sugestões) | Cards com valores |
| 1.3 | Verificar tabela de casos | Lista visível |
| 1.4 | Verificar filtros | Filtros de status e origem visíveis |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar caso de recuperação | Caso criado, aparece na lista |
| 2.2 | Visualizar detalhe do caso (sheet) | Sheet abre com informações completas |
| 2.3 | Marcar caso como pago | Status atualizado, KPI incrementado |
| 2.4 | Enviar mensagem de cobrança | Mensagem enviada via WhatsApp |
| 2.5 | Registrar promessa de pagamento | Promessa registrada com data |
| 2.6 | Filtrar por status (aberto/promessa/pago) | Lista filtrada |
| 2.7 | Filtrar por origem | Lista filtrada |
| 2.8 | Buscar caso por nome do contato | Resultados corretos |
| 2.9 | Aplicar playbook ao caso | Ações do playbook executadas |
| 2.10 | Gerar relatório com período | Relatório gerado |
| 2.11 | Async operations panel | Status de operações em andamento |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Criar caso sem contato | Validação "Contato obrigatório" |
| 3.2 | Criar caso sem valor | Validação "Valor obrigatório" |
| 3.3 | Valor negativo | Validação impede |
| 3.4 | Data de promessa no passado | Aviso ou bloqueio |
| 3.5 | Mensagem de cobrança vazia | Validação impede envio |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar por "aberto" | Apenas casos abertos |
| 4.2 | Filtrar por "promessa" | Apenas com promessa registrada |
| 4.3 | Filtrar por "pago" | Apenas casos pagos |
| 4.4 | Filtrar por origem (manual/automático) | Lista filtrada |
| 4.5 | Buscar por nome do devedor | Resultados corretos |
| 4.6 | Buscar por valor | Resultados corretos |
| 4.7 | Combinação de filtros | Resultados corretos |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 50+ casos | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |
| 5.3 | Filtro reseta paginação | Volta para página 1 |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: novo caso | Persistido |
| 6.2 | Read: detalhe do caso | Dados completos |
| 6.3 | Update: alterar status/valor | Dados atualizados |
| 6.4 | Delete: remover caso | Removido (se permitido) |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem casos de recuperação | Mensagem vazia, CTA criar |
| 7.2 | KPIs zerados | Cards com R$ 0,00 |
| 7.3 | Loading da lista | Skeletons |
| 7.4 | Loading do sheet de detalhe | Spinner |
| 7.5 | Sem playbooks configurados | Mensagem informativa |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao criar caso | Mensagem de erro |
| 8.2 | Envio de mensagem falha | Mensagem de erro, retry |
| 8.3 | Relatório falha | Mensagem de erro |
| 8.4 | Caso não encontrado (404) | Mensagem "Caso não encontrado" |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Valor de dívida R$ 0,01 | Aceito |
| 9.2 | Valor de dívida R$ 999.999,99 | Aceito, formatado |
| 9.3 | XSS na mensagem de cobrança | HTML escapado |
| 9.4 | SQL injection na busca | Input sanitizado |
| 9.5 | Marcar como pago duas vezes | Idempotente ou bloqueio |
| 9.6 | Promessa com data muito futura (2030) | Aceito ou limite |
| 9.7 | Caso com contato deletado | Tratamento gracioso |
| 9.8 | Enviar cobrança para número inválido | Erro tratado |
| 9.9 | Double-click em "Marcar como pago" | Apenas uma operação |
| 9.10 | Playbook com ações conflitantes | Execução sequencial |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Recovery em mobile (375px) | Cards empilhados, tabela scrollável |
| 10.2 | Recovery em tablet (768px) | Layout adaptado |
| 10.3 | Recovery em desktop (1440px) | Layout completo com sheet lateral |
| 10.4 | Sheet com focus trap | Tab contido |
| 10.5 | KPIs com aria-labels | Screen reader anuncia valores |
| 10.6 | Navegação por teclado | Focus em ações |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois atendentes marcam mesmo caso como pago | Apenas um sucesso |
| 11.2 | Editar caso enquanto outro envia cobrança | Consistência |
| 11.3 | Pagamento confirmado via webhook durante edição | Status atualizado |
| 11.4 | Double-click em enviar cobrança | Apenas uma mensagem |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver casos | Leitura permitida |
| 12.2 | Viewer tenta criar caso | Bloqueado |
| 12.3 | Operador pode gerenciar casos | Permitido |
| 12.4 | Casos de outro tenant | Nunca visíveis |
| 12.5 | Valores financeiros sensíveis | Acesso controlado por role |
