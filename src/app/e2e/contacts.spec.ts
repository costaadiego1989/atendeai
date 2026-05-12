import { test, expect } from '../playwright-fixture';

test.describe('Contacts', () => {
  test('should load contacts list page', async ({ page }) => {
    await page.goto('/app/contacts');

    await expect(page).toHaveURL(/\/app\/contacts/);

    // Should show a heading or title related to contacts
    const heading = page.getByRole('heading', { name: /contato|contact/i });
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display search or filter input', async ({ page }) => {
    await page.goto('/app/contacts');

    const searchInput = page.getByPlaceholder(/buscar|pesquisar|search|filtrar/i);
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show empty state or contact list', async ({ page }) => {
    await page.goto('/app/contacts');

    // Either a list of contacts or an empty state message
    const content = page.locator(
      '[data-testid="contacts-list"], table, [data-testid="empty-state"], .empty-state'
    );
    const emptyMessage = page.getByText(/nenhum contato|sem contatos|no contacts/i);

    const hasContent = await content.first().isVisible().catch(() => false);
    const hasEmpty = await emptyMessage.first().isVisible().catch(() => false);

    expect(hasContent || hasEmpty).toBe(true);
  });
});
