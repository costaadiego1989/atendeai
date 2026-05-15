/**
 * AI Context Pipeline — Integration Tests
 *
 * Tests the full context assembly chain:
 *   Tenant data  →  PromptBuilder  →  AIContextAggregator  →  systemPrompt enviado ao motor de IA
 *
 * Usa componentes REAIS: PromptBuilder + AIContextAggregator.
 * Moca apenas adaptadores externos: providers de contexto dinâmico e motor de IA.
 *
 * Cenários cobertos:
 *   1. Usuário pergunta sobre horário → Operating Hours presente no prompt
 *   2. Usuário pergunta sobre endereço → Location presente no prompt
 *   3. Usuário pergunta sobre cardápio/catálogo → PDF summary injetado sob [CONTEXTO DE DOCUMENTOS]
 *   4. Usuário pergunta sobre serviços → Services/Products presente no prompt
 *   5. Usuário pergunta sobre a empresa → Description presente no prompt
 *   6. PDF context isolado por tenantId — outro tenant não vê o PDF
 *   7. Múltiplos PDFs coexistem no contexto da mesma empresa
 *   8. catalogFiles (URLs) aparecem no prompt base mesmo sem summaries processados
 *   9. Primeira interação adiciona guardrail de boas-vindas sem despejar dados
 *  10. Nenhum dado configurado → prompt só tem persona de vendas, sem leaks
 */

jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: (_name: string, _attrs: unknown, fn: () => Promise<unknown>) => fn(),
}));

import { AIContextAggregator } from '../application/services/AIContextAggregator';
import { PromptBuilder } from '../domain/services/PromptBuilder';
import { ICommercialContextProvider } from '../application/ports/ICommercialContextProvider';
import { ICommerceContextProvider } from '../application/ports/ICommerceContextProvider';
import { ISchedulingContextProvider } from '../application/ports/ISchedulingContextProvider';
import { ITenantPDFContextProvider } from '../application/ports/ITenantPDFContextProvider';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { Address } from '@modules/tenant/domain/value-objects/Address';
import { AIConfig } from '@modules/tenant/domain/entities/AIConfig';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeTenant(_id = 'tenant-abc') {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Empresa Integração'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Dono',
        email: Email.create('dono@integracao.test'),
        phone: Phone.create('11999990000'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.configureAI(
    AIConfig.create({
      systemPrompt: 'Você é um assistente virtual prestativo.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 800,
      confidenceThreshold: 0.75,
      escalationMessage: 'Vou te transferir para um humano.',
      businessRules: [],
    }),
  );
  return tenant;
}

function makeAddress(override: Partial<Parameters<typeof Address.create>[0]> = {}) {
  return Address.create({
    zipcode: '01310-100',
    street: 'Avenida Paulista',
    streetNumber: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    ...override,
  });
}

function makeNullProviders() {
  const commercial: jest.Mocked<ICommercialContextProvider> = {
    findRelevantOffer: jest.fn().mockResolvedValue(null),
  };
  const commerce: jest.Mocked<ICommerceContextProvider> = {
    findConversationContext: jest.fn().mockResolvedValue(null),
  };
  const scheduling: jest.Mocked<ISchedulingContextProvider> = {
    findRelevantAvailability: jest.fn().mockResolvedValue(null),
  };
  const pdf: jest.Mocked<ITenantPDFContextProvider> = {
    findRelevantPDFContext: jest.fn().mockResolvedValue(null),
  };
  return { commercial, commerce, scheduling, pdf };
}

function makeAggregator(
  providers: ReturnType<typeof makeNullProviders>,
  pdfProvider?: ITenantPDFContextProvider,
) {
  return new AIContextAggregator(
    new PromptBuilder(),
    providers.commercial,
    providers.commerce,
    providers.scheduling,
    pdfProvider ?? providers.pdf,
    0,
  );
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('AI Context Pipeline — integração PromptBuilder + AIContextAggregator', () => {
  // 1 ─ Horário de Funcionamento
  describe('pergunta sobre horário de funcionamento', () => {
    it('systemPrompt contem Operating Hours quando usuario pergunta sobre horario', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        operatingHours: {
          monday: { open: '08:00', close: '18:00', closed: false },
          saturday: { open: '09:00', close: '13:00', closed: false },
          sunday: { open: '', close: '', closed: true },
        },
      });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Qual o horário de funcionamento de vocês?',
        false,
      );

      expect(systemPrompt).toContain('Operating Hours:');
      expect(systemPrompt).toContain('"08:00"');
      expect(systemPrompt).toContain('"18:00"');
      expect(systemPrompt).toContain('"saturday"');
      expect(systemPrompt).toContain('"sunday"');
    });

    it('nao expoe horarios quando nao configurados — AI nao inventa dados', async () => {
      const tenant = makeTenant();
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Qual o horário de funcionamento?',
        false,
      );

      expect(systemPrompt).not.toContain('Operating Hours:');
    });
  });

  // 2 ─ Endereço
  describe('pergunta sobre endereço / localização', () => {
    it('systemPrompt contem Location quando usuario pergunta sobre endereço', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({ address: makeAddress() });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Onde vocês ficam localizados?',
        false,
      );

      expect(systemPrompt).toContain('Location:');
      expect(systemPrompt).toContain('Avenida Paulista');
      expect(systemPrompt).toContain('Bela Vista');
      expect(systemPrompt).toContain('São Paulo');
      expect(systemPrompt).toContain('SP');
      expect(systemPrompt).toContain('01310-100');
    });

    it('nao expoe Location quando endereço nao configurado', async () => {
      const tenant = makeTenant();
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Qual o endereço?',
        false,
      );

      expect(systemPrompt).not.toContain('Location:');
    });
  });

  // 3 ─ PDF / Cardápio via TenantPDFContextProvider
  describe('pergunta sobre cardápio / catálogo — PDF context', () => {
    it('systemPrompt inclui [CONTEXTO DE DOCUMENTOS] quando PDF summary disponivel', async () => {
      const pdfSummary =
        'Cardápio: Pizza Margherita R$42, Pizza Calabresa R$45, Hamburguer Artesanal R$38. Bebidas: Suco Natural R$12.';
      const providers = makeNullProviders();
      providers.pdf.findRelevantPDFContext.mockResolvedValue(pdfSummary);
      const aggregator = makeAggregator(providers);
      const tenant = makeTenant();

      const { systemPrompt, diagnostics } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Vocês têm cardápio? Quais são os preços?',
        false,
      );

      expect(systemPrompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(systemPrompt).toContain('Pizza Margherita R$42');
      expect(systemPrompt).toContain('Hamburguer Artesanal R$38');
      expect(diagnostics.tenantPDFContextFound).toBe(true);
    });

    it('PDF context e buscado com tenantId correto para isolamento', async () => {
      const providers = makeNullProviders();
      providers.pdf.findRelevantPDFContext.mockResolvedValue('Conteudo PDF empresa A');
      const aggregator = makeAggregator(providers);
      const tenantA = makeTenant();

      await aggregator.aggregate(tenantA, 'conv-1', 'tem cardapio?', false);

      expect(providers.pdf.findRelevantPDFContext).toHaveBeenCalledWith(
        tenantA.id.toString(),
        'tem cardapio?',
      );
    });

    it('tenantB nao recebe PDF context de tenantA', async () => {
      const tenantA = makeTenant();
      const tenantB = makeTenant();

      const provA = makeNullProviders();
      const provB = makeNullProviders();

      provA.pdf.findRelevantPDFContext.mockImplementation(async (tid) =>
        tid === tenantA.id.toString() ? 'PDF exclusivo tenant A' : null,
      );
      provB.pdf.findRelevantPDFContext.mockResolvedValue(null);

      const aggA = makeAggregator(provA);
      const aggB = makeAggregator(provB);

      const resultA = await aggA.aggregate(tenantA, 'conv-1', 'cardapio?', false);
      const resultB = await aggB.aggregate(tenantB, 'conv-2', 'cardapio?', false);

      expect(resultA.systemPrompt).toContain('PDF exclusivo tenant A');
      expect(resultB.systemPrompt).not.toContain('PDF exclusivo tenant A');
      expect(resultB.diagnostics.tenantPDFContextFound).toBeUndefined();
    });

    it('systemPrompt nao inclui [CONTEXTO DE DOCUMENTOS] quando nenhum PDF processado', async () => {
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);
      const tenant = makeTenant();

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'vocês têm cardápio?',
        false,
      );

      expect(systemPrompt).not.toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
    });

    it('multiples PDFs somados num unico contexto injetado', async () => {
      const combinedSummary = [
        'Cardapio principal: Pizza, Massa, Salada.',
        'Tabela de precos delivery: taxa R$5 ate 5km.',
        'Promocoes vigentes: combo familia com 20% off.',
      ].join('\n');
      const providers = makeNullProviders();
      providers.pdf.findRelevantPDFContext.mockResolvedValue(combinedSummary);
      const aggregator = makeAggregator(providers);
      const tenant = makeTenant();

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'tem delivery? qual o preco?',
        false,
      );

      expect(systemPrompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(systemPrompt).toContain('taxa R$5 ate 5km');
      expect(systemPrompt).toContain('combo familia com 20% off');
    });
  });

  // 4 ─ catalogFiles (URLs no prompt base)
  describe('catalogFiles — URLs de PDFs no prompt base', () => {
    it('systemPrompt contem Knowledge Base com URLs quando catalogFiles configurado', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        catalogFiles: [
          'https://storage.test/cardapio-2025.pdf',
          'https://storage.test/tabela-precos.pdf',
        ],
      });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'tem cardapio?',
        false,
      );

      expect(systemPrompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(systemPrompt).toContain('https://storage.test/cardapio-2025.pdf');
      expect(systemPrompt).toContain('https://storage.test/tabela-precos.pdf');
    });
  });

  // 5 ─ Descrição e Serviços
  describe('pergunta sobre empresa / serviços', () => {
    it('systemPrompt contem Description quando usuario pergunta sobre a empresa', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        description: 'Clínica odontológica especializada em implantes e estética dental.',
      });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Me conta sobre a clínica.',
        false,
      );

      expect(systemPrompt).toContain('Description:');
      expect(systemPrompt).toContain('implantes e estética dental');
    });

    it('systemPrompt contem Services/Products quando usuario pergunta sobre servicos', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        services: 'Clareamento dental, implante osseointegrado, ortodontia, limpeza profissional',
      });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Quais tratamentos vocês fazem?',
        false,
      );

      expect(systemPrompt).toContain('Services/Products:');
      expect(systemPrompt).toContain('implante osseointegrado');
    });
  });

  // 6 ─ Primeiro contato — guardrail
  describe('primeira interação', () => {
    it('adiciona instrução de boas-vindas sem despejar todos os dados', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        operatingHours: { monday: { open: '08:00', close: '18:00', closed: false } },
        address: makeAddress(),
        services: 'Corte, barba, pigmentação',
      });
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt, diagnostics } = await aggregator.aggregate(
        tenant,
        'conv-first',
        'Oi',
        true,
      );

      expect(systemPrompt).toContain('[PRIMEIRA INTERAção]');
      expect(diagnostics.firstInteractionGuardrail).toBe(true);
      // Dados de negocio ainda presentes no contexto base
      expect(systemPrompt).toContain('Operating Hours:');
      expect(systemPrompt).toContain('Location:');
    });

    it('nao inclui guardrail de primeira interação em turnos subsequentes', async () => {
      const tenant = makeTenant();
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Qual o horário?',
        false,
      );

      expect(systemPrompt).not.toContain('[PRIMEIRA INTERAção]');
    });
  });

  // 7 ─ Nenhum dado configurado — sem vazamento
  describe('tenant sem dados de empresa configurados', () => {
    it('prompt nao contem secoes de dados de empresa — AI nao inventa informacoes', async () => {
      const tenant = makeTenant();
      const providers = makeNullProviders();
      const aggregator = makeAggregator(providers);

      const { systemPrompt } = await aggregator.aggregate(
        tenant,
        'conv-1',
        'Qual o horário? Onde ficam? Tem cardápio?',
        false,
      );

      expect(systemPrompt).not.toContain('Operating Hours:');
      expect(systemPrompt).not.toContain('Location:');
      expect(systemPrompt).not.toContain('Description:');
      expect(systemPrompt).not.toContain('Services/Products:');
      expect(systemPrompt).not.toContain('Knowledge Base');
      expect(systemPrompt).not.toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      // Instrução de sales persona ainda presente
      expect(systemPrompt).toContain('SENIOR SALES PERSONA INSTRUCTIONS');
    });
  });

  // 8 ─ Contexto completo — todos os dados de empresa + PDF
  describe('contexto completo — empresa totalmente configurada', () => {
    it('systemPrompt contem todos os dados quando empresa totalmente configurada', async () => {
      const tenant = makeTenant();
      tenant.updateBusinessData({
        businessType: 'Restaurante',
        description: 'Restaurante especializado em culinária italiana artesanal.',
        services: 'Almoço, jantar, delivery, eventos',
        catalogUrl: 'https://restaurante.test/cardapio',
        catalogFiles: ['https://storage.test/cardapio-full.pdf'],
        address: makeAddress(),
        operatingHours: {
          tuesday: { open: '11:30', close: '15:00', closed: false },
          saturday: { open: '12:00', close: '23:00', closed: false },
          sunday: { open: '', close: '', closed: true },
        },
      });

      const providers = makeNullProviders();
      providers.pdf.findRelevantPDFContext.mockResolvedValue(
        'Pizza Margherita R$42 · Carbonara R$52 · Tiramisù R$22',
      );
      const aggregator = makeAggregator(providers);

      const { systemPrompt, diagnostics } = await aggregator.aggregate(
        tenant,
        'conv-full',
        'Me fala tudo sobre o restaurante — horário, endereço e cardápio.',
        false,
      );

      // Dados estáticos (PromptBuilder)
      expect(systemPrompt).toContain('Business Type: Restaurante');
      expect(systemPrompt).toContain('culinária italiana artesanal');
      expect(systemPrompt).toContain('delivery');
      expect(systemPrompt).toContain('Catalog:');
      expect(systemPrompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(systemPrompt).toContain('Location:');
      expect(systemPrompt).toContain('Avenida Paulista');
      expect(systemPrompt).toContain('Operating Hours:');
      expect(systemPrompt).toContain('"tuesday"');
      // Dados dinâmicos (AIContextAggregator)
      expect(systemPrompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(systemPrompt).toContain('Pizza Margherita R$42');
      // Diagnostics
      expect(diagnostics.basePromptUsage).toBe(true);
      expect(diagnostics.tenantPDFContextFound).toBe(true);
    });
  });

  // 9 ─ PDF provider opcional (sem provider configurado)
  describe('PDF provider ausente', () => {
    it('pipeline nao quebra quando TenantPDFContextProvider nao injetado', async () => {
      const providers = makeNullProviders();
      const aggregatorSemPdf = new AIContextAggregator(
        new PromptBuilder(),
        providers.commercial,
        providers.commerce,
        providers.scheduling,
        undefined,
        0,
      );
      const tenant = makeTenant();

      const { systemPrompt } = await aggregatorSemPdf.aggregate(
        tenant,
        'conv-1',
        'tem cardapio?',
        false,
      );

      expect(systemPrompt).not.toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
    });
  });
});
