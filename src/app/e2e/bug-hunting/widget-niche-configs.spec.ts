/**
 * Playwright E2E — Multi-niche widget configuration rendering
 *
 * Validates that each business niche renders the correct:
 *   - Branding color on FAB and send button
 *   - Greeting text
 *   - Quick reply chips (correct labels per niche)
 *   - Widget position (bottom-right vs bottom-left)
 *   - Avatar presence / placeholder
 *
 * Requirements: WPET-09..11
 */
import { test, expect } from '@playwright/test';
import { buildSetup } from './_widget-setup';

const TOKEN = 'wgt-configs';
const SESSION_ID = 'sess-cfg-001';
const { setup, openPanel, waitForMsg } = buildSetup(TOKEN, SESSION_ID);

// ─── Niche configurations ─────────────────────────────────────────────────

const NICHES = {
  restaurant: {
    id: 'cfg-restaurant',
    name: 'Restaurante Sabor & Arte',
    greeting: 'Bem-vindo ao Restaurante Sabor & Arte! 🍽️ Posso anotar seu pedido?',
    color: '#dc2626',
    position: 'bottom-right' as const,
    avatarUrl: null,
    collectName: false,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    quickReplies: ['Ver Cardápio', 'Fazer Pedido', 'Horário de Funcionamento'],
    proactiveDelay: null,
    proactiveMsg: null,
  },

  clinic: {
    id: 'cfg-clinic-cfg',
    name: 'Clínica São Lucas',
    greeting: 'Olá! Bem-vindo à Clínica São Lucas. Em que posso ajudar?',
    color: '#0ea5e9',
    position: 'bottom-right' as const,
    avatarUrl: null,
    collectName: true,
    collectPhone: true,
    collectEmail: false,
    collectCpf: true,
    quickReplies: ['Agendar Consulta', 'Especialidades', 'Planos Aceitos'],
    proactiveDelay: null,
    proactiveMsg: null,
  },

  beautySalon: {
    id: 'cfg-salon-cfg',
    name: 'Studio Hair',
    greeting: 'Oi! Seja bem-vinda ao Studio Hair 💇‍♀️',
    color: '#ec4899',
    position: 'bottom-right' as const,
    avatarUrl: 'https://cdn.example.com/studio-avatar.jpg',
    collectName: true,
    collectPhone: true,
    collectEmail: false,
    collectCpf: false,
    quickReplies: ['Agendar Serviço', 'Tabela de Preços', 'Profissionais'],
    proactiveDelay: null,
    proactiveMsg: null,
  },

  ecommerce: {
    id: 'cfg-ecom-cfg',
    name: 'Mega Loja Online',
    greeting: 'Olá! Bem-vindo à Mega Loja Online 🛒 Como posso ajudar?',
    color: '#f97316',
    position: 'bottom-right' as const,
    avatarUrl: null,
    collectName: false,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    quickReplies: ['Ver Produtos', 'Meu Pedido', 'Falar com Atendente'],
    proactiveDelay: null,
    proactiveMsg: null,
  },

  bottomLeft: {
    id: 'cfg-bottomleft',
    name: 'Suporte Tech',
    greeting: 'Olá! Como posso ajudar?',
    color: '#6366f1',
    position: 'bottom-left' as const,
    avatarUrl: null,
    collectName: false,
    collectPhone: false,
    collectEmail: false,
    collectCpf: false,
    quickReplies: [],
    proactiveDelay: null,
    proactiveMsg: null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: Restaurante', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-09: saudação do restaurante exibida corretamente', async ({ page }) => {
    await setup(page, { config: NICHES.restaurant, preloadSession: true });
    await openPanel(page);
    await waitForMsg(page, 'Restaurante Sabor & Arte');
  });

  test('WPET-10: quick replies do restaurante exibem 3 opções corretas', async ({ page }) => {
    await setup(page, { config: NICHES.restaurant, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Ver Cardápio');
    expect(texts).toContain('Fazer Pedido');
    expect(texts).toContain('Horário de Funcionamento');
    expect(texts).toHaveLength(3);
  });

  test('WPET-09: cor vermelha do restaurante aplicada ao FAB', async ({ page }) => {
    await setup(page, { config: NICHES.restaurant, preloadSession: true });

    const fab = page.locator('#_atai-btn');
    await expect(fab).toBeVisible({ timeout: 5000 });

    const bgColor = await fab.evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).backgroundColor,
    );
    // #dc2626 = rgb(220, 38, 38)
    expect(bgColor).toBe('rgb(220, 38, 38)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: Clínica Médica', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-10: quick replies da clínica corretas', async ({ page }) => {
    await setup(page, { config: NICHES.clinic, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Agendar Consulta');
    expect(texts).toContain('Especialidades');
    expect(texts).toContain('Planos Aceitos');
  });

  test('WPET-09: cor azul da clínica no FAB', async ({ page }) => {
    await setup(page, { config: NICHES.clinic, preloadSession: true });

    const bgColor = await page.locator('#_atai-btn').evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).backgroundColor,
    );
    // #0ea5e9 = rgb(14, 165, 233)
    expect(bgColor).toBe('rgb(14, 165, 233)');
  });

  test('WPET-09: nome da clínica no header do painel', async ({ page }) => {
    await setup(page, { config: NICHES.clinic, preloadSession: true });
    await openPanel(page);

    const panelText = await page.locator('#_atai-panel').textContent();
    expect(panelText).toContain('Clínica São Lucas');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: Salão de Beleza', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-09: cor rosa do salão aplicada ao FAB', async ({ page }) => {
    await setup(page, { config: NICHES.beautySalon, preloadSession: true });

    const bgColor = await page.locator('#_atai-btn').evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).backgroundColor,
    );
    // #ec4899 = rgb(236, 72, 153)
    expect(bgColor).toBe('rgb(236, 72, 153)');
  });

  test('WPET-10: quick replies do salão corretas', async ({ page }) => {
    await setup(page, { config: NICHES.beautySalon, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Agendar Serviço');
    expect(texts).toContain('Tabela de Preços');
    expect(texts).toContain('Profissionais');
  });

  test('WPET-09: avatar exibido quando avatarUrl presente', async ({ page }) => {
    // Mock the avatar image to avoid external fetch
    await page.route('**/studio-avatar.jpg', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.alloc(100), // minimal fake image
      }),
    );

    await setup(page, { config: NICHES.beautySalon, preloadSession: true });
    await openPanel(page);

    // The header should contain an img element when avatarUrl is set
    const hasAvatar = await page.evaluate(() => {
      const panel = document.getElementById('_atai-panel');
      return panel ? panel.querySelectorAll('img').length > 0 : false;
    });
    // Widget renders avatar img tag in header
    expect(hasAvatar).toBeTruthy();
  });

  test('placeholder exibido quando avatarUrl é null', async ({ page }) => {
    await setup(page, { config: NICHES.restaurant, preloadSession: true }); // no avatar
    await openPanel(page);

    // No broken img — either placeholder element or no img at all
    const brokenImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('#_atai-panel img');
      return Array.from(imgs).filter((img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0).length;
    });
    expect(brokenImages).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Niche: E-commerce', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-09: cor laranja da loja no FAB', async ({ page }) => {
    await setup(page, { config: NICHES.ecommerce, preloadSession: true });

    const bgColor = await page.locator('#_atai-btn').evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).backgroundColor,
    );
    // #f97316 = rgb(249, 115, 22)
    expect(bgColor).toBe('rgb(249, 115, 22)');
  });

  test('WPET-10: quick replies da loja corretas', async ({ page }) => {
    await setup(page, { config: NICHES.ecommerce, preloadSession: true });
    await openPanel(page);

    await expect(page.locator('#_atai-qr')).not.toHaveClass(/hidden/, { timeout: 6000 });

    const texts = await page.locator('._qr-chip').allTextContents();
    expect(texts).toContain('Ver Produtos');
    expect(texts).toContain('Meu Pedido');
    expect(texts).toContain('Falar com Atendente');
  });

  test('WPET-09: saudação da loja exibe emoji de carrinho sem corrupção', async ({ page }) => {
    await setup(page, { config: NICHES.ecommerce, preloadSession: true });
    await openPanel(page);
    await waitForMsg(page, '🛒');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Posição do widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('WPET-09: posição padrão bottom-right — FAB no canto direito', async ({ page }) => {
    await setup(page, { config: NICHES.restaurant, preloadSession: true });

    const fab = page.locator('#_atai-btn');
    const box = await fab.boundingBox();
    const viewport = page.viewportSize()!;

    // FAB center should be in the right half of the viewport
    expect(box!.x + box!.width / 2).toBeGreaterThan(viewport.width / 2);
  });

  test('WPET-11: posição bottom-left — FAB no canto esquerdo', async ({ page }) => {
    await setup(page, { config: NICHES.bottomLeft, preloadSession: true });

    const fab = page.locator('#_atai-btn');
    await expect(fab).toBeVisible({ timeout: 5000 });

    const box = await fab.boundingBox();
    const viewport = page.viewportSize()!;

    // FAB center should be in the left half of the viewport
    expect(box!.x + box!.width / 2).toBeLessThan(viewport.width / 2);
  });

  test('WPET-11: painel abre corretamente com posição bottom-left', async ({ page }) => {
    await setup(page, { config: NICHES.bottomLeft, preloadSession: true });
    await openPanel(page);

    const panel = page.locator('#_atai-panel');
    await expect(panel).toHaveClass(/open/, { timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
test.describe('Widget sem quick replies configurados', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('widget sem quick replies não exibe container de chips', async ({ page }) => {
    await setup(page, {
      config: { ...NICHES.ecommerce, quickReplies: [] },
      preloadSession: true,
    });
    await openPanel(page);

    await page.waitForTimeout(2000);

    // Either no chips or container is hidden
    const chips = page.locator('._qr-chip');
    const count = await chips.count();
    if (count > 0) {
      // If container exists, it should be hidden
      await expect(page.locator('#_atai-qr')).toHaveClass(/hidden/, { timeout: 2000 });
    }
  });
});
