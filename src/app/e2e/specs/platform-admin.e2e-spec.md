# Módulo: Platform Admin

## Rotas Testadas
- `/platform-admin`
- `/platform-admin/tenants`
- `/platform-admin/tenants/:id`

## Pré-condições
- Usuário autenticado como platform admin (super admin)
- Tenants de teste criados com diferentes planos e status
- Quotas configuradas por tenant
- Dados de uso populados

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/platform-admin` | Dashboard admin carrega |
| 1.2 | Verificar KPIs globais | Cards com totais da plataforma |
| 1.3 | Verificar lista de tenants | Tabela carrega |
| 1.4 | Verificar campo de busca | Input visível |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Listar todos os tenants | Tabela com nome, plano, status, uso |
| 2.2 | Buscar tenant por nome | Resultados corretos |
| 2.3 | Visualizar KPIs globais | Total tenants, ativos, MRR, churn |
| 2.4 | Abrir detalhe do tenant (sheet) | Sheet com informações completas |
| 2.5 | Visualizar quotas do tenant (mensagens/tokens/contatos) | Valores corretos |
| 2.6 | Ajustar quota de mensagens | Valor atualizado |
| 2.7 | Ajustar quota de tokens IA | Valor atualizado |
| 2.8 | Ajustar quota de contatos | Valor atualizado |
| 2.9 | Gerar texto com IA (para comunicação) | Texto gerado |
| 2.10 | Enviar WhatsApp para tenant | Mensagem enviada |
| 2.11 | Suspender tenant | Status atualizado |
| 2.12 | Reativar tenant | Status atualizado |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Quota com valor negativo | Validação impede |
| 3.2 | Quota com valor 0 | Aceito (bloqueia uso) ou validação |
| 3.3 | Mensagem WhatsApp vazia | Validação impede envio |
| 3.4 | Quota > limite máximo da plataforma | Validação |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Buscar tenant por nome | Resultados corretos |
| 4.2 | Buscar tenant por email do owner | Resultados corretos |
| 4.3 | Filtrar por plano (Trial/Starter/Pro/Enterprise) | Lista filtrada |
| 4.4 | Filtrar por status (ativo/suspenso/cancelado) | Lista filtrada |
| 4.5 | Combinação de filtros | Resultados corretos |
| 4.6 | Busca sem resultados | Mensagem "Nenhum tenant encontrado" |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista com 100+ tenants | Paginação funcional |
| 5.2 | Navegar entre páginas | Dados corretos |
| 5.3 | Filtro reseta paginação | Volta para página 1 |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Read: listar tenants | Dados exibidos |
| 6.2 | Read: detalhe do tenant | Informações completas |
| 6.3 | Update: ajustar quotas | Valores atualizados |
| 6.4 | Update: suspender/reativar | Status atualizado |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Plataforma sem tenants (improvável) | Mensagem vazia |
| 7.2 | Loading da lista | Skeletons |
| 7.3 | Loading do sheet | Spinner |
| 7.4 | Gerando texto com IA | Spinner/loading |
| 7.5 | KPIs carregando | Skeletons nos cards |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao listar | Mensagem de erro, retry |
| 8.2 | API retorna 500 ao ajustar quota | Mensagem de erro |
| 8.3 | Envio de WhatsApp falha | Mensagem de erro |
| 8.4 | IA generation falha | Mensagem de erro, retry |
| 8.5 | Tenant não encontrado (404) | Mensagem "Tenant não encontrado" |
| 8.6 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS na busca | HTML escapado |
| 9.2 | SQL injection na busca | Input sanitizado |
| 9.3 | Quota = 999.999.999 | Aceito ou limite |
| 9.4 | Suspender tenant com usuários logados | Sessões invalidadas |
| 9.5 | Ajustar quota abaixo do uso atual | Aviso, uso excedente |
| 9.6 | Enviar WhatsApp para número inválido | Erro tratado |
| 9.7 | Gerar texto IA com prompt malicioso | Sanitizado |
| 9.8 | Double-click em suspender | Apenas uma operação |
| 9.9 | Reativar tenant com pagamento pendente | Aviso ou bloqueio |
| 9.10 | Lista com 10.000+ tenants | Performance aceitável |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Platform admin em mobile (375px) | Tabela scrollável |
| 10.2 | Platform admin em tablet (768px) | Layout adaptado |
| 10.3 | Platform admin em desktop (1440px) | Layout completo |
| 10.4 | Sheet com focus trap | Tab contido |
| 10.5 | Navegação por teclado na tabela | Focus em linhas |
| 10.6 | Screen reader em KPIs | Valores anunciados |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois admins ajustam quota do mesmo tenant | Último valor prevalece |
| 11.2 | Suspender enquanto tenant está em uso | Sessões encerradas graciosamente |
| 11.3 | Double-click em ajustar | Apenas uma operação |
| 11.4 | Tenant se auto-cancela enquanto admin edita | Estado consistente |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Apenas platform admin acessa | 403 para qualquer outro role |
| 12.2 | Owner de tenant tenta acessar | 403 Forbidden |
| 12.3 | Admin de tenant tenta acessar | 403 Forbidden |
| 12.4 | URL direta sem permissão | Redirect para login ou 403 |
| 12.5 | Dados sensíveis de tenants protegidos | Acesso auditado |
| 12.6 | Ações destrutivas requerem confirmação | Dialog de confirmação |
