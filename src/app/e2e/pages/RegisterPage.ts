import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Register page (/register).
 * Real heading: "Ative sua Máquina de Vendas"
 * Fields: Empresa, Tipo de negócio, Responsável, CNPJ, CPF do responsável, Email, Telefone, Senha, Confirmar senha
 * Button: "Criar Conta e Acessar"
 * Link: "Entrar" (back to login)
 */
export class RegisterPage extends BasePage {
  readonly companyInput: Locator;
  readonly responsibleInput: Locator;
  readonly cnpjInput: Locator;
  readonly cpfInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.companyInput = page.getByLabel('Empresa');
    this.responsibleInput = page.getByLabel('Responsável', { exact: true });
    this.cnpjInput = page.getByLabel('CNPJ');
    this.cpfInput = page.getByLabel('CPF do responsável');
    this.emailInput = page.getByLabel('Email');
    this.phoneInput = page.getByLabel('Telefone');
    this.passwordInput = page.getByLabel('Senha', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirmar senha');
    this.submitButton = page.getByRole('button', { name: /criar conta|cadastrar|começar/i });
    this.loginLink = page.getByRole('link', { name: /entrar|login|já tenho/i });
    this.heading = page.getByRole('heading', { name: /ative sua máquina de vendas/i });
  }

  async goto() {
    await this.page.goto('/register');
  }

  async assertPageVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
    await expect(this.companyInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  async fillForm(data: {
    company?: string;
    responsible?: string;
    cnpj?: string;
    cpf?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }) {
    if (data.company) await this.companyInput.fill(data.company);
    if (data.responsible) await this.responsibleInput.fill(data.responsible);
    if (data.cnpj) await this.cnpjInput.fill(data.cnpj);
    if (data.cpf) await this.cpfInput.fill(data.cpf);
    if (data.email) await this.emailInput.fill(data.email);
    if (data.phone) await this.phoneInput.fill(data.phone);
    if (data.password) await this.passwordInput.fill(data.password);
    if (data.confirmPassword) await this.confirmPasswordInput.fill(data.confirmPassword);
  }

  async submit() {
    await this.submitButton.click();
  }

  async assertValidationErrors() {
    const errors = this.page.locator('[role="alert"], .text-destructive, [data-error], p.text-sm.text-destructive');
    const htmlInvalid = this.page.locator(':invalid');
    const hasErrors = await errors.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasInvalid = await htmlInvalid.first().count().then(c => c > 0).catch(() => false);
    expect(hasErrors || hasInvalid).toBe(true);
  }
}
