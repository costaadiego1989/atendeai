# Módulo: Settings

## Rotas Testadas
- `/settings`
- `/settings/ai`
- `/settings/channels`
- `/settings/integrations`
- `/settings/tenant`

## Pré-condições
- Usuário autenticado como owner ou admin
- Tenant com dados cadastrados (CNPJ, endereço)
- Canal WhatsApp configurado
- Configurações de IA existentes

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/settings` | Página de configurações carrega |
| 1.2 | Verificar seções (empresa, canais, IA, integrações) | Todas visíveis |
| 1.3 | Verificar dados atuais preenchidos | Campos com valores salvos |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Editar dados da empresa (nome, CNPJ) | Dados salvos |
| 2.2 | Editar endereço da empresa | Endereço atualizado |
| 2.3 | Configurar canal WhatsApp (embedded signup) | Canal conectado |
| 2.4 | Configurar canal WhatsApp (OTP) | Canal verificado |
| 2.5 | Refresh status do canal | Status atualizado |
| 2.6 | Configurar IA (tom, contexto, limites) | Configurações salvas |
| 2.7 | Configurar integrações | Integração ativada |
| 2.8 | Configurar roteamento de conversas | Regras salvas |
| 2.9 | Salvar alterações gerais | Toast de sucesso |
| 2.10 | Configurar promoções settings | Configurações salvas |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | CNPJ inválido | Mensagem "CNPJ inválido" |
| 3.2 | CNPJ com formato incorreto | Validação de formato |
| 3.3 | Telefone inválido | Mensagem de formato |
| 3.4 | CEP inválido | Mensagem "CEP inválido" |
| 3.5 | Email de contato inválido | Mensagem "Email inválido" |
| 3.6 | Nome da empresa vazio | Validação "Nome obrigatório" |
| 3.7 | Prompt de IA vazio (se obrigatório) | Validação |
| 3.8 | Prompt de IA > 10.000 caracteres | Validação de tamanho |

### 4. Filtros e Busca
N/A para settings (formulários de configuração).

### 5. Paginação
N/A para settings.

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Read: dados atuais | Campos preenchidos |
| 6.2 | Update: alterar dados | Dados salvos |
| 6.3 | Create: adicionar canal | Canal criado |
| 6.4 | Delete: remover canal | Canal removido |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Tenant sem dados cadastrados | Campos vazios, CTA preencher |
| 7.2 | Sem canais configurados | Mensagem "Configure um canal" |
| 7.3 | Loading de configurações | Skeletons |
| 7.4 | Salvando alterações | Spinner no botão |
| 7.5 | IA não configurada | Formulário vazio com defaults |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | API retorna 500 ao salvar | Mensagem de erro, dados preservados |
| 8.2 | WhatsApp embedded signup falha | Mensagem de erro |
| 8.3 | OTP inválido | Mensagem "Código inválido" |
| 8.4 | Integração OAuth falha | Mensagem de erro, retry |
| 8.5 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS no nome da empresa | HTML escapado |
| 9.2 | SQL injection no CNPJ | Input sanitizado |
| 9.3 | CNPJ com pontuação (12.345.678/0001-90) | Aceito e normalizado |
| 9.4 | Telefone com +55 e sem | Ambos aceitos |
| 9.5 | Prompt de IA com injection attempts | Sanitizado |
| 9.6 | Salvar sem alterações | Noop ou mensagem "Sem alterações" |
| 9.7 | Navegar sem salvar (dirty form) | Confirmação "Deseja sair sem salvar?" |
| 9.8 | Double-click em salvar | Apenas um save |
| 9.9 | CEP com auto-complete de endereço | Campos preenchidos automaticamente |
| 9.10 | Desconectar WhatsApp com conversas ativas | Confirmação extra |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Settings em mobile (375px) | Formulários empilhados |
| 10.2 | Settings em tablet (768px) | Layout adaptado |
| 10.3 | Settings em desktop (1440px) | Layout com sidebar |
| 10.4 | Navegação por teclado | Tab entre campos |
| 10.5 | Labels associados aos inputs | Screen reader identifica |
| 10.6 | Mensagens de erro acessíveis | aria-live anuncia |
| 10.7 | Seções com headings corretos | Hierarquia h1-h6 |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Dois admins editam settings simultaneamente | Último save vence ou conflito |
| 11.2 | Salvar enquanto outro desconecta canal | Estado consistente |
| 11.3 | Double-click em conectar WhatsApp | Apenas um fluxo |
| 11.4 | Refresh durante save | Dados consistentes |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Apenas owner/admin pode acessar settings | Redirect para outros |
| 12.2 | Operador tenta acessar | Bloqueado |
| 12.3 | Viewer tenta acessar | Bloqueado |
| 12.4 | CNPJ e dados sensíveis protegidos | Não expostos em logs |
| 12.5 | API keys de integrações mascaradas | Apenas últimos caracteres |
| 12.6 | Settings de outro tenant | Nunca acessíveis |
