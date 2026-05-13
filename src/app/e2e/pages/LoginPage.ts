import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Login page (/login).
 * Real heading: "Acesse sua Máquina de Vendas"
 * Fields: Email, Senha
 * Button: Entrar
 * Links: "Esqueci minha senha", "Cadastre-se"
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Senha');
    this.submitButton = page.getByRole('button', { name: 'Entrar' });
    this.forgotPasswordLink = page.getByRole('link', { name: /esqueci minha senha/i });
    this.registerLink = page.getByRole('link', { name: /cadastre-se/i });
    this.heading = page.getByRole('heading', { name: /acesse sua máquina de vendas/i });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async assertValidationErrors() {
    // The app uses HTML5 validation or inline error messages
    const errors = this.page.locator('[role="alert"], .text-destructive, [data-error], p.text-sm.text-destructive');
    const htmlInvalid = this.page.locator(':invalid');
    const hasErrors = await errors.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasInvalid = await htmlInvalid.first().count().then(c => c > 0).catch(() => false);
    expect(hasErrors || hasInvalid).toBe(true);
  }

  async assertLoginError() {
    // Radix UI toast with variant destructive, or toast text content
    const errorIndicator = this.page.locator('[data-state="open"][class*="destructive"]')
      .or(this.page.getByText(/falha no login|limite de tentativas|não foi possível/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
  }

  async assertRedirectToDashboard() {
    await this.page.waitForURL(/\/app\//, { timeout: 15_000 });
    await expect(this.page).toHaveURL(/\/app\//);
  }

  async assertSubmitButtonDisabled() {
    await expect(this.submitButton).toBeDisabled();
  }

  async assertSubmitButtonEnabled() {
    await expect(this.submitButton).toBeEnabled();
  }
}

