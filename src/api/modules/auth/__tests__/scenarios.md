# Cenários de Teste: Auth Module

## 1. Login & Emissão de Tokens
- **Nome:** Autenticação de Usuário (Owner)
- **Descrição:** Validar o processo de login e geração de credentials.
- **Entrada (Input):** Email e Password em formato JSON.
- **Comportamento Lógico:**
  - Buscar `TenantOwner` pelo email.
  - Comparar hashes de senha (bcrypt).
  - Gerar JWT assinado (Access Token e Refresh Token).
  - Persistir `RefreshToken` no Redis/Banco para controle de sessão.
- **Resultado Esperado (Sucesso/Saída):** HTTP 200 OK com cookies (HttpOnly) e payload JSON contendo dados básicos do perfil.
- **Casos de Erro (Error/Validation):**
  - **Senha Incorreta:** Retornar 401 Unauthorized.
  - **Email Não Encontrado:** Retornar 401 Unauthorized (evitar vazamento de dados).
  - **Formato Inválido:** Login curto demais ou email fora do padrão (400 Bad Request).

## 2. Renovação de Sessão (Refresh Token)
- **Nome:** Ciclo de Vida do Token.
- **Descrição:** Garantir que o usuário continue logado sem reinserir senha.
- **Entrada (Input):** Cookie `refreshToken`.
- **Comportamento Lógico:**
  - Validar assinatura do Refresh Token.
  - Verificar se o token não foi revogado no banco/Redis.
  - Emitir novos `accessToken` e `refreshToken`.
- **Resultado Esperado (Sucesso/Saída):** HTTP 200 com novos cookies de autenticação.
- **Casos de Erro (Error/Validation):**
  - **Token Expirado:** Retornar 401.
  - **Token Revogado:** Bloquear acesso imediato (401).

## 3. Segurança de Integração (ApiKeyGuard)
- **Nome:** Validação de API Key Externa.
- **Descrição:** Proteger endpoints de integrações (BubbleWhats, etc).
- **Entrada (Input):** Header `x-api-key`.
- **Comportamento Lógico:**
  - Buscar `Tenant` que possua a API Key enviada.
  - Injetar o `TenantId` no objeto da Requisição para uso nos UseCases.
- **Resultado Esperado (Sucesso/Saída):** Continuidade da execução da rota.
- **Casos de Erro (Error/Validation):**
  - **Key Inexistente/Incorreta:** Retornar 401 Unauthorized.
  - **Key Desativada:** Retornar 401/403.
