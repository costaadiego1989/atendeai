# Módulo: Auth

## Rotas Testadas
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password/:token`
- `/first-access/:token`

## Pré-condições
- Banco de dados com tenant e usuário de teste criados
- Servidor de email mockado para capturar tokens
- Rate limiter configurado para ambiente de teste

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/login` | Página carrega com campos email e senha visíveis |
| 1.2 | Acessar `/register` | Formulário de registro com todos os campos |
| 1.3 | Acessar `/forgot-password` | Campo de email e botão de envio |
| 1.4 | Acessar `/reset-password` sem token | Redirect para `/login` ou mensagem de erro |
| 1.5 | Acessar `/first-access` sem token | Redirect para `/login` ou mensagem de erro |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Login com credenciais válidas | Redirect para `/dashboard`, token armazenado |
| 2.2 | Registro completo com dados válidos | Conta criada, redirect para onboarding ou dashboard |
| 2.3 | Forgot password com email existente | Email enviado, mensagem de confirmação exibida |
| 2.4 | Reset password com token válido | Senha alterada, redirect para login |
| 2.5 | Primeiro acesso com token válido | Senha definida, redirect para dashboard |
| 2.6 | Logout | Token removido, redirect para `/login` |
| 2.7 | Refresh token automático | Sessão renovada sem interrupção do usuário |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Login com email vazio | Mensagem "Email obrigatório" |
| 3.2 | Login com senha vazia | Mensagem "Senha obrigatória" |
| 3.3 | Login com email inválido (sem @) | Mensagem "Email inválido" |
| 3.4 | Registro com senha fraca (< 8 chars) | Mensagem de requisitos de senha |
| 3.5 | Registro com senhas não coincidentes | Mensagem "Senhas não coincidem" |
| 3.6 | Registro com email já existente | Mensagem "Email já cadastrado" |
| 3.7 | Registro com telefone inválido | Mensagem de formato inválido |
| 3.8 | Reset password com senha fraca | Mensagem de requisitos de senha |
| 3.9 | Campos com espaços em branco apenas | Tratados como vazios |

### 4. Filtros e Busca
N/A para este módulo.

### 5. Paginação
N/A para este módulo.

### 6. CRUD Completo
N/A para este módulo (auth não tem CRUD tradicional).

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Botão de login durante requisição | Botão desabilitado com spinner/loading |
| 7.2 | Botão de registro durante requisição | Botão desabilitado com spinner/loading |
| 7.3 | Forgot password durante envio | Botão desabilitado, feedback visual |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | Login com credenciais inválidas (401) | Mensagem "Email ou senha incorretos" |
| 8.2 | API retorna 500 no login | Mensagem genérica de erro, botão reabilitado |
| 8.3 | API retorna 429 (rate limit) | Mensagem "Muitas tentativas, aguarde X minutos" |
| 8.4 | API retorna 503 (manutenção) | Mensagem de indisponibilidade |
| 8.5 | Timeout na requisição de login | Mensagem de erro de conexão |
| 8.6 | Reset password com token expirado (410) | Mensagem "Link expirado, solicite novo" |
| 8.7 | Reset password com token inválido (400) | Mensagem "Link inválido" |
| 8.8 | Registro com tenant no limite de usuários | Mensagem de limite atingido |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | SQL injection no campo email: `'; DROP TABLE users;--` | Input sanitizado, erro de validação |
| 9.2 | XSS no campo nome: `<script>alert(1)</script>` | HTML escapado, sem execução |
| 9.3 | Email com 255+ caracteres | Validação de tamanho máximo |
| 9.4 | Senha com caracteres unicode extremos (emojis, RTL) | Aceita ou rejeita consistentemente |
| 9.5 | Path traversal no token: `../../etc/passwd` | Token inválido, sem acesso a arquivos |
| 9.6 | Múltiplos submits rápidos (double-click) | Apenas uma requisição enviada |
| 9.7 | Token de reset reutilizado após uso | Mensagem "Token já utilizado" |
| 9.8 | Login com email em case diferente (UPPER) | Login funciona (case-insensitive) |
| 9.9 | Copiar/colar senha com espaços invisíveis | Espaços trimados ou tratados |
| 9.10 | Campo email com espaços antes/depois | Espaços trimados automaticamente |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Login em mobile (375px) | Layout adaptado, campos usáveis |
| 10.2 | Login em tablet (768px) | Layout adaptado |
| 10.3 | Login em desktop (1440px) | Layout completo |
| 10.4 | Navegação por Tab entre campos | Ordem lógica: email → senha → botão |
| 10.5 | Enter no campo senha submete form | Formulário enviado |
| 10.6 | Labels associados aos inputs (aria-label) | Screen reader identifica campos |
| 10.7 | Mensagens de erro anunciadas (aria-live) | Screen reader lê erros |
| 10.8 | Contraste de cores nos textos de erro | WCAG AA compliance |
| 10.9 | Focus visível em todos os elementos interativos | Outline visível |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Double-click no botão de login | Apenas uma requisição enviada |
| 11.2 | Login em duas tabs simultaneamente | Ambas redirecionam para dashboard |
| 11.3 | Reset password aberto em duas tabs | Apenas o primeiro uso do token funciona |
| 11.4 | Sessão expirada durante preenchimento | Ao submeter, redireciona para login |
| 11.5 | Refresh da página durante requisição | Estado consistente após reload |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Acessar `/dashboard` sem autenticação | Redirect para `/login` |
| 12.2 | Token JWT manipulado manualmente | API rejeita, redirect para login |
| 12.3 | Token expirado | Refresh automático ou redirect para login |
| 12.4 | Usuário desativado tenta login | Mensagem "Conta desativada" |
| 12.5 | Tenant suspenso tenta login | Mensagem "Conta suspensa, contate suporte" |
| 12.6 | CSRF protection | Tokens CSRF validados em formulários |
| 12.7 | Senha não exposta em logs/network | Campo type="password", não logado |
| 12.8 | Brute force protection | Bloqueio após N tentativas |
