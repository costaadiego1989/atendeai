import { PromptBuilder } from '../domain/services/PromptBuilder';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { AIConfig } from '@modules/tenant/domain/entities/AIConfig';
import { Address } from '@modules/tenant/domain/value-objects/Address';
import { Promotion } from '@modules/tenant/domain/value-objects/Promotion';

function makeTenant() {
  return Tenant.create({
    companyName: CompanyName.create('Prompt Company'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner User',
        email: Email.create('owner@prompt.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
}

describe('PromptBuilder', () => {
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
  });

  it('should build a default prompt with company name and sales persona instructions', () => {
    const tenant = makeTenant();

    const prompt = promptBuilder.build(tenant);

    expect(prompt).toContain('You are a helpful virtual assistant.');
    expect(prompt).toContain('Company Name: Prompt Company');
    expect(prompt).toContain('SENIOR SALES PERSONA INSTRUCTIONS');
    expect(prompt).toContain('Na primeira interação, cumprimente brevemente');
    expect(prompt).toContain('não liste automaticamente endereço, horários');
  });

  it('should include business context, address, rules, promotions and preferred language', () => {
    const tenant = makeTenant();
    tenant.configureAI(
      AIConfig.create({
        systemPrompt: 'You are a premium sales assistant.',
        tone: 'PROFESSIONAL',
        language: 'pt-BR',
        maxTokensPerResponse: 900,
        confidenceThreshold: 0.8,
        escalationMessage: 'Vou escalar',
        businessRules: ['não prometer desconto sem autorização'],
        salesInstructions: 'Sempre finalizar com CTA.',
      }),
    );
    tenant.updateBusinessData({
      businessType: 'Barbearia',
      description: 'Atendimento premium',
      services: 'Corte, barba e pigmentação',
      catalogUrl: 'https://empresa.test/catalogo',
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
      },
      address: Address.create({
        zipcode: '01000-000',
        street: 'Rua Central',
        streetNumber: '123',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
      }),
      promotions: [
        Promotion.create({
          title: 'Combo Premium',
          description: 'Corte e barba com desconto especial',
          value: '59.90',
        }),
      ],
    });

    const prompt = promptBuilder.build(tenant);

    expect(prompt).toContain('You are a premium sales assistant.');
    expect(prompt).toContain('Business Type: Barbearia');
    expect(prompt).toContain('Description: Atendimento premium');
    expect(prompt).toContain('Services/Products: Corte, barba e pigmentação');
    expect(prompt).toContain('Catalog: https://empresa.test/catalogo');
    expect(prompt).toContain('Location: Rua Central, Centro, Sao Paulo, SP, 01000-000');
    expect(prompt).toContain('Response Tone: PROFESSIONAL');
    expect(prompt).toContain('Specific Business Rules:');
    expect(prompt).toContain('- não prometer desconto sem autorização');
    expect(prompt).toContain('Additional Sales Instructions:');
    expect(prompt).toContain('Sempre finalizar com CTA.');
    expect(prompt).toContain('Active Promotions:');
    expect(prompt).toContain('Combo Premium');
    expect(prompt).toContain('Preferred Language: pt-BR');
    expect(prompt).toContain(
      'Conduza a conversa por descoberta: entenda o que a pessoa quer',
    );
  });

  it('should guide gym businesses to sell recurring packages with payment link', () => {
    const tenant = makeTenant();
    tenant.updateBusinessData({
      businessType: 'Academia',
      description: 'Studio de treino funcional e personal trainer',
      services:
        'Plano mensal de academia, pacote de 8 aulas de personal e avaliacao fisica',
    });

    const prompt = promptBuilder.build(tenant);

    expect(tenant.cnpj.value).toBe('60.701.190/0001-04');
    expect(prompt).toContain('Business Type: Academia');
    expect(prompt).toContain('RECURRING PACKAGE SALES');
    expect(prompt).toContain('pacote vendavel');
    expect(prompt).toContain('Para academia, studio ou personal');
    expect(prompt).toContain('[PAYMENT_LINK: Nome do pacote recorrente, Valor]');
    expect(prompt).toContain('vincula o pacote ao cadastro do cliente');
  });
});
