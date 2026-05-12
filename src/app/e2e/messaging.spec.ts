import { test, expect } from '../playwright-fixture';

test.describe('Messaging', () => {
  test('should load conversations page', async ({ page }) => {
    await page.goto('/app/conversations');

    await expect(page).toHaveURL(/\/app\/conversations/);

    // Should render the conversations layout
    const layout = page.locator(
      '[data-testid="conversations"], main, [role="main"]'
    );
    await expect(layout.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display conversation list or empty state', async ({ page }) => {
    await page.goto('/app/conversations');

    const list = page.locator(
      '[data-testid="conversation-list"], [role="list"], ul, .conversation-item'
    );
    const emptyState = page.getByText(/nenhuma conversa|sem conversas|no conversations/i);

    const hasList = await list.first().isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBe(true);
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/app/conversations');

    const search = page.getByPlaceholder(/buscar|pesquisar|search/i);
    await expect(search.first()).toBeVisible({ timeout: 10_000 });
  });
});
