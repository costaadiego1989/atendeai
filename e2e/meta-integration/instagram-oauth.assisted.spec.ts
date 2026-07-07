import { test, expect, Page } from '@playwright/test';

/**
 * Meta Instagram OAuth — Assisted E2E Test
 *
 * This test automates the AtendeAi side of the flow but PAUSES
 * on the Facebook login screen for you to authenticate manually
 * (handles 2FA, CAPTCHA, account selection).
 *
 * Prerequisites:
 * - API running: `cd src/api && npm run dev:api`
 * - Web running: `cd src/web && npm run dev`
 * - Valid tenant account logged in (or credentials in env)
 * - META_APP_ID, META_APP_SECRET configured in API .env
 * - META_INSTAGRAM_LOGIN_CONFIG_ID configured (or fallback scopes)
 * - META_OAUTH_REDIRECT_URI pointing to your local/ngrok URL
 *
 * Run:
 *   npx playwright test --config e2e/meta-integration/playwright.config.ts
 */

const APP_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

// Test credentials — set via env or fill here for local testing
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || '';
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || '';

test.describe('Instagram OAuth — Social Module (Assisted)', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: Login to AtendeAi', async () => {
    await page.goto(`${APP_URL}/login`);

    if (TENANT_EMAIL && TENANT_PASSWORD) {
      await page.fill('input[name="email"], input[type="email"]', TENANT_EMAIL);
      await page.fill(
        'input[name="password"], input[type="password"]',
        TENANT_PASSWORD,
      );
      await page.click('button[type="submit"]');
      await page.waitForURL('**/app/**', { timeout: 15_000 });
    } else {
      // Manual login — pause and wait for user
      console.log('\n⏸️  Please login to AtendeAi manually...');
      await page.pause();
    }

    // Verify we're logged in
    await expect(page).toHaveURL(/\/app\//);
  });

  test('Step 2: Navigate to Social page and initiate Instagram connection', async () => {
    await page.goto(`${APP_URL}/app/social`);
    await page.waitForLoadState('networkidle');

    // Look for "Connect Instagram" or similar button
    const connectButton = page.locator(
      'button:has-text("Instagram"), button:has-text("Conectar"), a:has-text("Instagram")',
    );

    if (await connectButton.count() > 0) {
      await connectButton.first().click();
    } else {
      // If no button on Social page, try API directly
      console.log('\n⚠️  No connect button found on Social page.');
      console.log('    Initiating OAuth via API directly...');

      const tenantId = await page.evaluate(() => {
        // Try to get tenantId from app state
        return (
          (window as any).__tenantId ||
          localStorage.getItem('tenantId') ||
          document.cookie.match(/tenantId=([^;]+)/)?.[1] ||
          'unknown'
        );
      });

      // Call initiate endpoint directly
      const response = await page.request.get(
        `${API_URL}/api/v1/tenants/${tenantId}/social/oauth/instagram/initiate`,
      );

      if (response.ok()) {
        const data = await response.json();
        const authUrl = data.authUrl || data.authorizationUrl;
        if (authUrl) {
          await page.goto(authUrl);
        }
      } else {
        console.log('    API initiate failed, pausing for manual action...');
        await page.pause();
      }
    }
  });

  test('Step 3: PAUSE — Complete Facebook/Instagram login manually', async () => {
    // At this point the browser should be on Facebook's login/authorization page
    console.log('\n' + '='.repeat(60));
    console.log('⏸️  MANUAL STEP REQUIRED');
    console.log('='.repeat(60));
    console.log('\n  The browser is now on Facebook\'s OAuth page.');
    console.log('  Please:');
    console.log('  1. Login to your Facebook/Instagram account');
    console.log('  2. Authorize the AtendeAi app');
    console.log('  3. Select the Instagram account to connect');
    console.log('  4. Wait for the redirect back to AtendeAi');
    console.log('\n  After completing, press "Resume" in Playwright Inspector.');
    console.log('='.repeat(60) + '\n');

    // Pause — user must complete Facebook login + authorization
    await page.pause();

    // After resume, we should be redirected back
    // Either to META_OAUTH_SUCCESS_URL or the popup closed
  });

  test('Step 4: Verify OAuth callback succeeded', async () => {
    // Wait for redirect back to AtendeAi
    await page.waitForURL(
      (url) => {
        const href = url.toString();
        return (
          href.includes('instagram_connected=true') ||
          href.includes('/app/social') ||
          href.includes('instagram_error')
        );
      },
      { timeout: 60_000 },
    );

    const currentUrl = page.url();

    if (currentUrl.includes('instagram_error')) {
      const errorParam = new URL(currentUrl).searchParams.get('instagram_error');
      console.log(`\n❌ OAuth failed with error: ${errorParam}`);
      expect(errorParam).toBeNull(); // Force fail with error info
    } else {
      console.log('\n✅ Instagram OAuth callback succeeded!');
      expect(
        currentUrl.includes('instagram_connected=true') ||
          currentUrl.includes('/app/social'),
      ).toBe(true);
    }
  });

  test('Step 5: Verify Instagram account appears in Social page', async () => {
    await page.goto(`${APP_URL}/app/social`);
    await page.waitForLoadState('networkidle');

    // Wait a bit for data to refresh
    await page.waitForTimeout(2000);

    // Check the page shows at least 1 connected account
    const accountsText = await page.textContent('body');
    const hasAccount =
      accountsText?.includes('instagram') ||
      accountsText?.includes('Instagram') ||
      accountsText?.includes('Contas conectadas');

    console.log(
      hasAccount
        ? '\n✅ Instagram account visible on Social page'
        : '\n⚠️  Could not confirm Instagram account on page (may need manual verification)',
    );
  });
});

test.describe('Instagram OAuth — Channels Module (Assisted)', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: Login and navigate to channels/settings', async () => {
    await page.goto(`${APP_URL}/login`);

    if (TENANT_EMAIL && TENANT_PASSWORD) {
      await page.fill('input[name="email"], input[type="email"]', TENANT_EMAIL);
      await page.fill(
        'input[name="password"], input[type="password"]',
        TENANT_PASSWORD,
      );
      await page.click('button[type="submit"]');
      await page.waitForURL('**/app/**', { timeout: 15_000 });
    } else {
      console.log('\n⏸️  Please login to AtendeAi manually...');
      await page.pause();
    }

    await expect(page).toHaveURL(/\/app\//);
  });

  test('Step 2: Start Instagram Meta channel connection via API', async () => {
    // The channels flow uses a popup, so we intercept the postMessage
    const popupPromise = page.context().waitForEvent('page');

    // Call the start endpoint
    const response = await page.request.post(
      `${API_URL}/api/v1/channels/instagram/meta/start`,
    );

    if (response.ok()) {
      const data = await response.json();
      const authUrl = data.authorizationUrl;

      if (authUrl) {
        console.log('\n🔗 Opening Meta OAuth URL in new tab...');
        await page.goto(authUrl);
      }
    } else {
      console.log(
        `\n⚠️  Start endpoint returned ${response.status()}. Pausing...`,
      );
      await page.pause();
    }
  });

  test('Step 3: PAUSE — Complete Facebook login for channels', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('⏸️  MANUAL STEP — Facebook Login for Channels');
    console.log('='.repeat(60));
    console.log('\n  Login and authorize. Press Resume when redirected back.');
    console.log('='.repeat(60) + '\n');

    await page.pause();
  });

  test('Step 4: Verify channel callback returns accounts', async () => {
    // After the OAuth redirect, the callback returns HTML with postMessage
    // or redirects. Check we got accounts data.
    const bodyText = await page.textContent('body');

    const hasSuccess =
      bodyText?.includes('Instagram conectado') ||
      bodyText?.includes('atendeai-meta-instagram-oauth');

    if (hasSuccess) {
      console.log('\n✅ Channels callback succeeded — accounts returned');
    } else {
      console.log(
        '\n⚠️  Callback page content (check manually):',
        bodyText?.slice(0, 200),
      );
    }
  });
});

test.describe('WhatsApp Embedded Signup (Assisted)', () => {
  test('Manual WhatsApp connection flow', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('⏸️  WhatsApp Embedded Signup');
    console.log('='.repeat(60));
    console.log('\n  This flow requires the Meta JS SDK in the frontend.');
    console.log('  1. Navigate to Settings > Channels > WhatsApp');
    console.log('  2. Click "Connect WhatsApp" (Meta Cloud)');
    console.log('  3. Complete the Embedded Signup in the popup');
    console.log('  4. Verify the phone number appears connected');
    console.log('\n  Press Resume after completing each step.');
    console.log('='.repeat(60) + '\n');

    await page.goto(`${APP_URL}/login`);

    if (TENANT_EMAIL && TENANT_PASSWORD) {
      await page.fill('input[name="email"], input[type="email"]', TENANT_EMAIL);
      await page.fill(
        'input[name="password"], input[type="password"]',
        TENANT_PASSWORD,
      );
      await page.click('button[type="submit"]');
      await page.waitForURL('**/app/**', { timeout: 15_000 });
    } else {
      await page.pause();
    }

    // Navigate to WhatsApp settings
    console.log('\n⏸️  Navigate to WhatsApp channel settings and connect...');
    await page.pause();

    // After manual completion, verify connection
    console.log('\n✅ WhatsApp Embedded Signup test completed (manual verification)');
  });
});
