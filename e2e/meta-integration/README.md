# Meta Integration E2E Tests (Assisted)

## O que são

Testes E2E com Playwright que validam os fluxos de OAuth do Instagram e WhatsApp Embedded Signup usando contas reais da Meta. O Playwright automatiza a parte do AtendeAi mas **pausa** na tela de login do Facebook para você autenticar manualmente.

## Pré-requisitos

1. **API rodando:** `cd src/api && npm run dev:api`
2. **Web rodando:** `cd src/web && npm run dev`
3. **Variáveis Meta configuradas no `.env`:**
   ```
   META_APP_ID=your-app-id
   META_APP_SECRET=your-app-secret
   META_GRAPH_API_VERSION=v21.0
   META_OAUTH_REDIRECT_URI=https://your-ngrok-url/api/v1/social/oauth/instagram/callback
   META_OAUTH_SUCCESS_URL=http://localhost:5173/app/social
   META_INSTAGRAM_OAUTH_REDIRECT_URI=https://your-ngrok-url/api/v1/channels/instagram/meta/callback
   META_INSTAGRAM_LOGIN_CONFIG_ID=your-config-id
   ```
4. **Callback URLs registradas** no [Meta App Dashboard](https://developers.facebook.com/apps/) > Facebook Login > Valid OAuth Redirect URIs
5. **Conta Instagram Business** vinculada a uma Facebook Page

## Como rodar

```bash
# Rodar todos os testes assistidos (Instagram + WhatsApp)
npx playwright test --config e2e/meta-integration/playwright.config.ts

# Rodar só Instagram Social
npx playwright test --config e2e/meta-integration/playwright.config.ts -g "Social Module"

# Rodar só Instagram Channels
npx playwright test --config e2e/meta-integration/playwright.config.ts -g "Channels Module"

# Rodar só WhatsApp
npx playwright test --config e2e/meta-integration/playwright.config.ts -g "WhatsApp"
```

## Variáveis de ambiente do teste

| Variável | Default | Descrição |
|----------|---------|----------|
| `E2E_BASE_URL` | `http://localhost:5173` | URL do frontend |
| `E2E_API_URL` | `http://localhost:3000` | URL da API |
| `E2E_TENANT_EMAIL` | (vazio = login manual) | Email do tenant para auto-login |
| `E2E_TENANT_PASSWORD` | (vazio = login manual) | Senha do tenant |

## Fluxo do teste

### Instagram (Social Module)
1. ✅ Login no AtendeAi (automático ou manual)
2. ✅ Navega para /app/social e clica "Conectar Instagram"
3. ⏸️ **PAUSA** — Você faz login no Facebook e autoriza
4. ✅ Verifica que o callback retornou sucesso
5. ✅ Verifica que a conta aparece na página Social

### Instagram (Channels Module)
1. ✅ Login no AtendeAi
2. ✅ Inicia conexão via API (popup)
3. ⏸️ **PAUSA** — Facebook login no popup
4. ✅ Verifica que callback retornou lista de contas

### WhatsApp (Embedded Signup)
1. ✅ Login no AtendeAi
2. ⏸️ **PAUSA** — Navega para settings, completa Embedded Signup
3. ✅ Verificação manual

## Dicas

- Use **ngrok** para expor o localhost ao Meta: `ngrok http 3000`
- Atualize `META_OAUTH_REDIRECT_URI` e `META_INSTAGRAM_OAUTH_REDIRECT_URI` com a URL do ngrok
- Registre a URL do ngrok no Meta App Dashboard
- O teste tem timeout de 5 minutos para dar tempo ao login manual
- Se o teste falhar no callback, verifique os logs da API (`docker compose logs api`)
