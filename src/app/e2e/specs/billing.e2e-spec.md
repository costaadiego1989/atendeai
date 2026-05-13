# Módulo: Billing

## Rotas Testadas
- `/billing`
- `/billing/usage`

## Pré-condições
- Usuário autenticado com tenant ativo
- Plano ativo (Trial, Starter, Pro, Enterprise)
- Dados de uso (mensagens, tokens IA, contatos) populados
- Módulos adicionais disponíveis para recomendação

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/billing` | Página de billing carrega |
| 1.2 | Verificar KPIs de uso | Cards com barras de progresso |
| 1.3 | Verificar plano atual | Nome do plano exibido |
| 1.4 | Verificar botão de upgrade | Visível se não está no plano máximo |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Visualizar KPIs de uso (mensagens) | Barra de progresso com usado/total |
| 2.2 | Visualizar KPIs de uso (tokens IA) | Barra de progresso com usado/total |
| 2.3 | Visualizar KPIs de uso (contatos) | Barra de progresso com usado/total |
| 2.4 | Alerta de limite 80% | Aviso visual quando uso > 80% |
| 2.5 | Visualizar plano agendado (upgrade futuro) | Informação do próximo plano |
| 2.6 | Assistente de escolha de plano | Wizard com perguntas e recomendação |
| 2.7 | Comparação de planos | Tabela comparativa com features |
| 2.8 | Exportar CSV de uso | Download com histórico de consumo |
| 2.9 | Cancelar assinatura | Fluxo de cancelamento com confirmação |
| 2.10 | Módulos recomendados | Sugestões baseadas no uso |
| 2.11 | Upgrade de plano | Fluxo de pagamento e ativação |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Cancelamento sem motivo (se obrigatório) | Validação exige motivo |
| 3.2 | Upgrade sem método de pagamento | Solicita cadastro de cartão |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar uso por período (mês atual/anterior) | Dados filtrados |
| 4.2 | Comparar planos por categoria | Filtro funcional |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Histórico de faturas com 12+ meses | Paginação funcional |

### 6. CRUD Completo
N/A (billing é gerenciado via assinatura, não CRUD tradicional).

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Tenant novo sem uso | Barras em 0%, mensagem informativa |
| 7.2 | Loading de dados de uso | Skeletons nas barras |
| 7.3 | Sem faturas | Mensagem "Nenhuma fatura" |
| 7.4 | Plano Trial sem histórico | Informação do trial |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API de uso retorna 500 | Mensagem de erro, retry |
| 8.2 | API de planos retorna 500 | Mensagem de erro |
| 8.3 | Falha no processamento de pagamento | Mensagem clara do erro |
| 8.4 | Timeout na exportação | Mensagem de erro |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Uso em 100% (limite atingido) | Barra cheia, alerta, CTA upgrade |
| 9.2 | Uso em 0% | Barra vazia, sem alerta |
| 9.3 | Uso > 100% (overage) | Indicador de excesso |
| 9.4 | Cancelar e reativar rapidamente | Estado consistente |
| 9.5 | Upgrade durante período de trial | Trial encerrado, plano ativado |
| 9.6 | Downgrade com uso acima do novo limite | Aviso de perda de funcionalidade |
| 9.7 | Múltiplos cliques em "Confirmar upgrade" | Apenas uma transação |
| 9.8 | Valores monetários com formatação BR | R$ correto |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Billing em mobile (375px) | Cards empilhados |
| 10.2 | Billing em tablet (768px) | Layout adaptado |
| 10.3 | Billing em desktop (1440px) | Layout completo |
| 10.4 | Barras de progresso com aria-valuenow | Screen reader anuncia % |
| 10.5 | Tabela de planos acessível | Headers e cells corretos |
| 10.6 | Navegação por teclado | Focus em botões de ação |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Upgrade em duas tabs | Apenas uma transação |
| 11.2 | Cancelamento durante upgrade | Estado final consistente |
| 11.3 | Uso atualizado enquanto página aberta | Refresh mostra dados atuais |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Apenas owner/admin pode alterar plano | Botões ocultos para outros |
| 12.2 | Viewer pode ver uso | Leitura permitida |
| 12.3 | Operador não pode cancelar | Ação bloqueada |
| 12.4 | Dados de billing de outro tenant | Nunca visíveis |
| 12.5 | Informações de cartão mascaradas | Apenas últimos 4 dígitos |
