# Módulo: Checkout

## Rotas Testadas
- `/checkout/:linkId` (página pública)
- `/checkout/success`
- `/checkout/pending`

## Pré-condições
- Payment link ativo criado pelo tenant
- Produtos/serviços vinculados ao link
- Gateway de pagamento configurado (PIX, cartão)
- Endereço de entrega habilitado (se aplicável)

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar checkout com link válido | Página carrega com etapas |
| 1.2 | Acessar checkout com link inválido | Mensagem "Link não encontrado" |
| 1.3 | Acessar checkout com link expirado | Mensagem "Link expirado" |
| 1.4 | Acessar checkout com link pausado | Mensagem "Link indisponível" |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Etapa 1: Identificação (nome, email, telefone) | Dados preenchidos, avança |
| 2.2 | Etapa 2: Seleção de produto/serviço | Item selecionado |
| 2.3 | Etapa 3: Quantidade | Quantidade definida |
| 2.4 | Etapa 4: Endereço de entrega | CEP preenchido, endereço auto-completado |
| 2.5 | Etapa 5: Pagamento PIX | QR code gerado, aguarda confirmação |
| 2.6 | Etapa 5: Pagamento cartão | Dados do cartão, processamento |
| 2.7 | Checkout completo com sucesso | Redirect para página de sucesso |
| 2.8 | Adicionar observação ao pedido | Observação salva |
| 2.9 | Cálculo de frete por CEP | Valor de frete exibido |
| 2.10 | Aplicar cupom de desconto | Valor atualizado com desconto |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Identificação sem nome | Mensagem "Nome obrigatório" |
| 3.2 | Email inválido | Mensagem "Email inválido" |
| 3.3 | Telefone inválido | Mensagem de formato |
| 3.4 | CEP inválido | Mensagem "CEP inválido" |
| 3.5 | CEP inexistente | Mensagem "CEP não encontrado" |
| 3.6 | Cartão com número inválido | Mensagem de validação |
| 3.7 | Cartão expirado | Mensagem "Cartão expirado" |
| 3.8 | CVV inválido | Mensagem de validação |
| 3.9 | Quantidade = 0 | Validação mínimo 1 |
| 3.10 | Quantidade > estoque disponível | Mensagem de limite |
| 3.11 | Cupom inválido | Mensagem "Cupom inválido" |
| 3.12 | Cupom expirado | Mensagem "Cupom expirado" |

### 4. Filtros e Busca
N/A para checkout (fluxo linear).

### 5. Paginação
N/A para checkout.

### 6. CRUD Completo
N/A (checkout é um fluxo de criação de pedido).

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Loading do checkout | Skeleton das etapas |
| 7.2 | Processando pagamento | Spinner com mensagem "Processando..." |
| 7.3 | Aguardando confirmação PIX | Timer + status "Aguardando pagamento" |
| 7.4 | Produto sem estoque | Mensagem "Indisponível" |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API de CEP retorna 500 | Mensagem de erro, input manual |
| 8.2 | Gateway de pagamento retorna erro | Mensagem "Falha no pagamento, tente novamente" |
| 8.3 | Timeout no processamento | Mensagem com orientação |
| 8.4 | Pagamento recusado pelo banco | Mensagem clara do motivo |
| 8.5 | Link fica inválido durante checkout | Mensagem de indisponibilidade |
| 8.6 | Produto esgota durante checkout | Mensagem de indisponibilidade |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS no campo nome | HTML escapado |
| 9.2 | SQL injection no campo email | Input sanitizado |
| 9.3 | Quantidade = 99999 | Validação de limite máximo |
| 9.4 | Cupom com caracteres especiais | Sanitizado |
| 9.5 | Voltar etapas e alterar dados | Dados preservados corretamente |
| 9.6 | Refresh da página durante checkout | Estado preservado ou reinício limpo |
| 9.7 | Fechar aba e reabrir link | Checkout reinicia |
| 9.8 | PIX timeout (30 min) | Mensagem de expiração, gerar novo |
| 9.9 | Double-click no "Finalizar" | Apenas um pedido criado |
| 9.10 | Abandono de carrinho (sair no meio) | Dados não persistidos indevidamente |
| 9.11 | Número de cartão com espaços/hífens | Sanitização automática |
| 9.12 | CEP com pontuação (12345-678) | Aceito e normalizado |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Checkout em mobile (375px) | Etapas empilhadas, usável |
| 10.2 | Checkout em tablet (768px) | Layout adaptado |
| 10.3 | Checkout em desktop (1440px) | Layout com sidebar de resumo |
| 10.4 | Navegação por teclado entre etapas | Tab funcional |
| 10.5 | Screen reader nas etapas | Progresso anunciado |
| 10.6 | Labels em inputs de cartão | Acessíveis |
| 10.7 | QR code com alt text | Descrição para screen reader |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois clientes fazem checkout do último item | Primeiro vence, segundo recebe "esgotado" |
| 11.2 | Pagamento PIX confirmado após timeout | Pedido criado se ainda válido |
| 11.3 | Double-click no botão de pagamento | Apenas uma cobrança |
| 11.4 | Link pausado durante checkout ativo | Checkout em andamento pode concluir |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Checkout é público (sem auth) | Acessível sem login |
| 12.2 | Dados de cartão não logados | Sem PCI exposure |
| 12.3 | Link de outro tenant | Funciona (é público) |
| 12.4 | Manipular preço via DevTools | Preço validado no backend |
| 12.5 | Manipular quantidade via request | Validação server-side |
