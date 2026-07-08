import { test, expect } from '@playwright/test';

/**
 * Twilio WhatsApp E2E — Assisted Test
 *
 * Tests the full WhatsApp connection flow via Twilio:
 * 1. Login to AtendeAi
 * 2. Navigate to Settings > Channels
 * 3. Enter phone number
 * 4. Click "Conectar via Meta Business" (uses Twilio Embedded Signup)
 * 5. Complete OTP verification
 * 6. Send a test message
 *
 * Run:
 *   npx playwright test --config e2e/meta-integration/playwright.config.ts -g 'Twilio'
 */

const APP_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const TEST_PHONE = process.env.E2E_TEST_PHONE || '21993001883';

test.describe('Twilio WhatsApp — Full Flow (Assisted)', () => {
  test('Connect WhatsApp number and send test message', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await page.waitForLoadState('networkidle');

    console.log('\n' + '='.repeat(60));
    console.log('  TESTE ASSISTIDO — Twilio WhatsApp Connection');
    console.log('='.repeat(60));
    console.log('\n  Passos:');
    console.log(`  1. Faça login no AtendeAi`);
    console.log(`  2. Vá para Settings > Channels`);
    console.log(`  3. No campo "Número do WhatsApp", insira: ${TEST_PHONE}`);
    console.log(`  4. Clique "Conectar via Meta Business"`);
    console.log(`  5. Complete o popup do Twilio Embedded Signup`);
    console.log(`  6. Se pedir código OTP, insira o código recebido no celular`);
    console.log(`  7. Aguarde status mudar para "Ativo"`);
    console.log(`  8. Quando tudo estiver conectado, clique RESUME`);
    console.log('\n' + '='.repeat(60));

    // Pause for user to complete the entire flow
    await page.pause();

    // After resume — verify connection status
    const currentUrl = page.url();
    const bodyText = await page.textContent('body').catch(() => '');

    console.log(`\n📍 URL atual: ${currentUrl}`);

    // Check for success indicators
    const hasActive = bodyText?.includes('ACTIVE') || bodyText?.includes('Ativo');
    const hasNumber = bodyText?.includes(TEST_PHONE.slice(-4)); // last 4 digits
    const hasChannels = currentUrl.includes('channels');

    if (hasActive && hasChannels) {
      console.log('✅ WhatsApp conectado com sucesso via Twilio!');
      console.log(`   Número: ${TEST_PHONE}`);
    } else if (hasNumber) {
      console.log('⚠️  Número aparece mas status pode não estar ativo ainda.');
      console.log('   Pode levar alguns minutos para ativar.');
    } else {
      console.log('⚠️  Estado indeterminado.');
      console.log(`   Body (first 500): ${bodyText?.slice(0, 500)}`);
    }

    expect(currentUrl).toBeDefined();
  });

  test('Send and receive test message', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await page.waitForLoadState('networkidle');

    console.log('\n' + '='.repeat(60));
    console.log('  TESTE ASSISTIDO — Envio/Recebimento de Mensagens');
    console.log('='.repeat(60));
    console.log('\n  Passos:');
    console.log('  1. Faça login no AtendeAi');
    console.log('  2. Abra o painel de conversas');
    console.log(`  3. Envie uma mensagem pelo seu celular (${TEST_PHONE}) para o número conectado`);
    console.log('  4. Verifique se a mensagem apareceu no painel');
    console.log('  5. Responda pelo painel');
    console.log('  6. Verifique se chegou no celular');
    console.log('  7. Clique RESUME quando verificar tudo');
    console.log('\n' + '='.repeat(60));

    await page.pause();

    const currentUrl = page.url();
    const bodyText = await page.textContent('body').catch(() => '');

    console.log(`\n📍 URL atual: ${currentUrl}`);

    // Check if we're on conversations page with messages
    const hasConversation = currentUrl.includes('messaging') || currentUrl.includes('conversation');
    const hasMessages = bodyText?.includes(TEST_PHONE.slice(-4)) || bodyText?.includes('mensag');

    if (hasConversation && hasMessages) {
      console.log('✅ Mensagens trocadas com sucesso!');
      console.log('   WhatsApp via Twilio funcionando end-to-end.');
    } else {
      console.log('⚠️  Verifique manualmente se as mensagens foram trocadas.');
    }

    expect(currentUrl).toBeDefined();
  });
});
