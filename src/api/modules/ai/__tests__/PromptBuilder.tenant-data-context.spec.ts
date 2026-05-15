/**
 * PromptBuilder — Tenant Data Context Coverage
 *
 * Verifies that every piece of company data configured by the tenant owner
 * is correctly injected into the system prompt so the AI can answer user
 * questions about operating hours, address, catalog, description, etc.
 *
 * These are unit tests: no I/O, no HTTP, just PromptBuilder.build(tenant).
 */

import { PromptBuilder } from '../domain/services/PromptBuilder';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { Address } from '@modules/tenant/domain/value-objects/Address';
import { Promotion } from '@modules/tenant/domain/value-objects/Promotion';

function makeTenant() {
  return Tenant.create({
    companyName: CompanyName.create('Empresa Teste'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Dono',
        email: Email.create('dono@empresa.test'),
        phone: Phone.create('11999990000'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
}

function makeAddress() {
  return Address.create({
    zipcode: '01310-100',
    street: 'Avenida Paulista',
    streetNumber: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  });
}

describe('PromptBuilder — tenant data → AI context', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  // ─── Horário de Funcionamento ──────────────────────────────────────────────

  describe('horário de funcionamento', () => {
    it('inclui operating hours quando configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        operatingHours: {
          monday: { open: '08:00', close: '18:00', closed: false },
          tuesday: { open: '08:00', close: '18:00', closed: false },
          saturday: { open: '09:00', close: '13:00', closed: false },
          sunday: { open: '', close: '', closed: true },
        },
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Operating Hours:');
      expect(prompt).toContain('"monday"');
      expect(prompt).toContain('"08:00"');
      expect(prompt).toContain('"18:00"');
      expect(prompt).toContain('"saturday"');
      expect(prompt).toContain('"sunday"');
    });

    it('omite operating hours quando nao configurado', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Operating Hours:');
    });

    it('representa fechamento (closed: true) no contexto', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        operatingHours: {
          sunday: { open: '', close: '', closed: true },
        },
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Operating Hours:');
      expect(prompt).toContain('"closed":true');
    });
  });

  // ─── Endereço ──────────────────────────────────────────────────────────────

  describe('endereço', () => {
    it('inclui Location com todos os campos quando endereço configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({ address: makeAddress() });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Location:');
      expect(prompt).toContain('Avenida Paulista');
      expect(prompt).toContain('Bela Vista');
      expect(prompt).toContain('São Paulo');
      expect(prompt).toContain('SP');
      expect(prompt).toContain('01310-100');
    });

    it('omite Location quando endereço nao configurado', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Location:');
    });

    it('inclui apenas os campos de endereço preenchidos', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        address: Address.create({
          zipcode: '20040-020',
          street: 'Rua da Quitanda',
          streetNumber: '86',
          neighborhood: '',
          city: 'Rio de Janeiro',
          state: 'RJ',
        }),
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Rua da Quitanda');
      expect(prompt).toContain('Rio de Janeiro');
      expect(prompt).toContain('RJ');
      expect(prompt).toContain('20040-020');
    });
  });

  // ─── Descrição Comercial e Serviços ────────────────────────────────────────

  describe('descrição e serviços', () => {
    it('inclui Description quando configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        description: 'Barbearia premium especializada em cortes modernos e tratamentos de barba.',
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Description:');
      expect(prompt).toContain('Barbearia premium especializada em cortes modernos');
    });

    it('inclui Services/Products quando configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        services: 'Corte masculino, barba, pigmentação capilar, hidratação',
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Services/Products:');
      expect(prompt).toContain('Corte masculino, barba, pigmentação capilar');
    });

    it('inclui Business Type quando configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({ businessType: 'Barbearia' });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Business Type: Barbearia');
    });

    it('omite Description, Services e Business Type quando ausentes', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Description:');
      expect(prompt).not.toContain('Services/Products:');
      expect(prompt).not.toContain('Business Type:');
    });

    it('inclui descricao e servicos juntos para contexto completo', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        businessType: 'Clinica Odontológica',
        description: 'Clinica especializada em saúde bucal com foco em estética dental.',
        services: 'Clareamento, implante, ortodontia, limpeza, restauração',
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Business Type: Clinica Odontológica');
      expect(prompt).toContain('Description:');
      expect(prompt).toContain('saúde bucal');
      expect(prompt).toContain('Services/Products:');
      expect(prompt).toContain('ortodontia');
    });
  });

  // ─── Catálogo — URL e Arquivos PDF ─────────────────────────────────────────

  describe('catálogo — catalogUrl e catalogFiles', () => {
    it('inclui Catalog (URL) quando catalogUrl configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        catalogUrl: 'https://empresa.test/cardapio.pdf',
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Catalog:');
      expect(prompt).toContain('https://empresa.test/cardapio.pdf');
    });

    it('inclui Knowledge Base quando catalogFiles tem arquivos', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        catalogFiles: [
          'https://storage.test/cardapio-2025.pdf',
          'https://storage.test/tabela-precos.pdf',
        ],
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(prompt).toContain('https://storage.test/cardapio-2025.pdf');
      expect(prompt).toContain('https://storage.test/tabela-precos.pdf');
    });

    it('cada arquivo PDF aparece como item de lista separado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        catalogFiles: [
          'https://storage.test/menu.pdf',
          'https://storage.test/promo.pdf',
          'https://storage.test/cardapio-drinks.pdf',
        ],
      });

      const prompt = builder.build(tenant);

      const lines = prompt.split('\n');
      const pdfLines = lines.filter((l) => l.startsWith('- https://storage.test/'));
      expect(pdfLines).toHaveLength(3);
    });

    it('omite Knowledge Base quando catalogFiles esta vazio', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({ catalogFiles: [] });

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Knowledge Base');
    });

    it('omite Catalog quando catalogUrl nao configurado', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Catalog:');
    });

    it('inclui catalogUrl e catalogFiles simultaneamente', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        catalogUrl: 'https://empresa.test/catalogo',
        catalogFiles: ['https://storage.test/cardapio.pdf'],
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Catalog:');
      expect(prompt).toContain('https://empresa.test/catalogo');
      expect(prompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(prompt).toContain('https://storage.test/cardapio.pdf');
    });
  });

  // ─── Promoções ─────────────────────────────────────────────────────────────

  describe('promoções', () => {
    it('inclui Active Promotions quando configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        promotions: [
          Promotion.create({
            title: 'Combo Verão',
            description: 'Corte + barba com 15% de desconto',
            value: '49.90',
          }),
        ],
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Active Promotions:');
      expect(prompt).toContain('Combo Verão');
      expect(prompt).toContain('Corte + barba com 15% de desconto');
      expect(prompt).toContain('49.90');
    });

    it('inclui multiplas promoções como lista', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        promotions: [
          Promotion.create({ title: 'Promo A', description: 'Descricao promocao A', value: '29.90' }),
          Promotion.create({ title: 'Promo B', description: 'Descricao promocao B', value: '59.90' }),
        ],
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Promo A');
      expect(prompt).toContain('Promo B');
    });

    it('omite Active Promotions quando nao ha promoções', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).not.toContain('Active Promotions:');
    });
  });

  // ─── Contexto completo — todos os campos ───────────────────────────────────

  describe('contexto completo — todos os dados configurados', () => {
    it('prompt contem todos os dados da empresa quando tudo configurado', () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        businessType: 'Restaurante',
        description: 'Restaurante contemporâneo com culinária brasileira artesanal.',
        services: 'Almoço, jantar, delivery, eventos privados',
        catalogUrl: 'https://restaurante.test/cardapio',
        catalogFiles: ['https://storage.test/cardapio-completo.pdf'],
        address: makeAddress(),
        operatingHours: {
          monday: { open: '11:30', close: '15:00', closed: false },
          tuesday: { open: '11:30', close: '15:00', closed: false },
          wednesday: { open: '11:30', close: '23:00', closed: false },
          saturday: { open: '12:00', close: '23:00', closed: false },
          sunday: { open: '', close: '', closed: true },
        },
        promotions: [
          Promotion.create({
            title: 'Happy Hour',
            description: 'Bebidas com 30% de desconto das 18h às 20h',
            value: '0',
          }),
        ],
      });

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Business Type: Restaurante');
      expect(prompt).toContain('Description:');
      expect(prompt).toContain('culinária brasileira artesanal');
      expect(prompt).toContain('Services/Products:');
      expect(prompt).toContain('delivery');
      expect(prompt).toContain('Catalog:');
      expect(prompt).toContain('https://restaurante.test/cardapio');
      expect(prompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(prompt).toContain('cardapio-completo.pdf');
      expect(prompt).toContain('Location:');
      expect(prompt).toContain('Avenida Paulista');
      expect(prompt).toContain('Operating Hours:');
      expect(prompt).toContain('"monday"');
      expect(prompt).toContain('"sunday"');
      expect(prompt).toContain('Active Promotions:');
      expect(prompt).toContain('Happy Hour');
    });

    it('prompt sem dados de empresa contem apenas nome e persona de vendas', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).toContain('Company Name: Empresa Teste');
      expect(prompt).toContain('SENIOR SALES PERSONA INSTRUCTIONS');
      expect(prompt).not.toContain('Description:');
      expect(prompt).not.toContain('Services/Products:');
      expect(prompt).not.toContain('Location:');
      expect(prompt).not.toContain('Operating Hours:');
      expect(prompt).not.toContain('Catalog:');
      expect(prompt).not.toContain('Knowledge Base');
      expect(prompt).not.toContain('Active Promotions:');
    });
  });

  // ─── Instrução de nao listar automaticamente ────────────────────────────────

  describe('instrução de discovery — não listar automaticamente', () => {
    it('instrui a IA a nao despejar endereço, horarios e catalogo sem contexto', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).toContain(
        'não liste automaticamente endereço, horários, promocoes, serviços ou catalogo completo',
      );
    });

    it('instrui a IA a usar dados apenas quando relevante para a pergunta', () => {
      const tenant = makeTenant();

      const prompt = builder.build(tenant);

      expect(prompt).toContain('a menos que isso seja relevante para a pergunta do cliente');
      expect(prompt).toContain('Conduza a conversa por descoberta');
    });
  });
});
