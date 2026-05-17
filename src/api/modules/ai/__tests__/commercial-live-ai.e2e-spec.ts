import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '../application/ports/IChatHistoryRepository';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '@modules/tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import { IUpdateBusinessDataUseCase } from '@modules/tenant/application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';
import { CreateSchedulingCategoryUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingCategoryUseCase';
import { CreateSchedulingProfessionalUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingProfessionalUseCase';
import { AssignProfessionalCategoriesUseCase } from '@modules/scheduling/application/use-cases/AssignProfessionalCategoriesUseCase';
import { SetProfessionalAvailabilityUseCase } from '@modules/scheduling/application/use-cases/SetProfessionalAvailabilityUseCase';

const describeRealAI =
  process.env.RUN_REAL_AI_E2E === 'true' ? describe : describe.skip;

type LiveScenario = {
  key: 'mercado' | 'petshop' | 'barbearia' | 'clinica' | 'curso';
  companyName: string;
  companyType: string;
  description: string;
  services: string;
  inboundText: string;
  expectedContextSignals: string[];
  minimumSignals: number;
  ctaSignals?: string[];
};

describeRealAI('Commercial live AI mapping (e2e)', () => {
  jest.setTimeout(180000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processAI: IProcessAIResponseUseCase;
  let chatHistory: IChatHistoryRepository;
  const createdTenantIds: string[] = [];
  const createdConversationIds: string[] = [];

  const scenarios: LiveScenario[] = [
    {
      key: 'mercado',
      companyName: 'Mercado Bom preço',
      companyType: 'mercado',
      description: 'Mercado de bairro com mercearia, bebidas e conveniencia.',
      services: 'Mercearia, bebidas, limpeza e itens do dia a dia',
      inboundText: 'Quanto esta o cafe 500g e voces tem em estoque agora?',
      expectedContextSignals: [
        'cafe',
        'estoque',
        '500g',
        'quantidade',
        'disponivel',
        'preço',
      ],
      minimumSignals: 2,
      ctaSignals: [
        'posso separar',
        'faco seu pedido',
        'quer reservar',
        'se quiser',
      ],
    },
    {
      key: 'petshop',
      companyName: 'Pet Feliz',
      companyType: 'petshop',
      description: 'Pet shop com banho, tosa e loja de acessorios.',
      services: 'Banho, tosa, vacinas, rações e acessorios',
      inboundText: 'Voces abrem hoje ate que horas?',
      expectedContextSignals: [
        '08:00',
        '18:00',
        '08h',
        '18h',
        'horário',
        'aberto',
        'funcionamento',
      ],
      minimumSignals: 2,
    },
    {
      key: 'barbearia',
      companyName: 'Barbearia Prime',
      companyType: 'barbearia',
      description: 'Barbearia premium com atendimento personalizado.',
      services: 'Corte masculino, barba, acabamento e combo premium',
      inboundText: 'Tenho um casamento no sabado, o que voce recomenda?',
      expectedContextSignals: [
        'casamento',
        'barba',
        'corte',
        'acabamento',
        'premium',
        'visual',
      ],
      minimumSignals: 2,
      ctaSignals: [
        'agendar',
        'reservar horário',
        'posso te indicar',
        'quer que eu',
      ],
    },
    {
      key: 'clinica',
      companyName: 'Clinica Sorriso',
      companyType: 'clinica',
      description: 'Clinica odontologica com foco em estetica dental.',
      services: 'Avaliação, limpeza, clareamento e lentes de resina',
      inboundText:
        'Quero marcar um clareamento amanha e ja reservar o horário.',
      expectedContextSignals: [
        'clareamento',
        'agendar',
        'reservar',
        'horário',
        '14:00',
        '14h',
        'amanha',
      ],
      minimumSignals: 2,
      ctaSignals: ['confirmar', 'agendar', 'reservar', 'horário'],
    },
    {
      key: 'curso',
      companyName: 'Ingles de Impacto',
      companyType: 'curso',
      description:
        'Escola de idiomas com cursos intensivos e acompanhamento individual.',
      services: 'Matricula, intensivo de ingles, aulas em grupo e mentoria',
      inboundText:
        'Quero garantir minha matricula no intensivo de ingles hoje.',
      expectedContextSignals: [
        'matricula',
        'intensivo',
        'ingles',
        'vaga',
        'inscrição',
        'garantir',
      ],
      minimumSignals: 2,
      ctaSignals: [
        'garantir sua vaga',
        'prosseguir com a matricula',
        'quer que eu',
        'posso te',
      ],
    },
  ];

  function makeValidCnpj(seed: number): string {
    const base = String(seed).padStart(12, '0').slice(-12);
    const calcDigit = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const digit1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const digit2 = calcDigit(
      `${base}${digit1}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    const cnpj = `${base}${digit1}${digit2}`;
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  function getTomorrowDate(): string {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    return tomorrow.toISOString().slice(0, 10);
  }

  function normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  function expectCallToAction(text: string, scenario: LiveScenario) {
    const normalized = normalizeText(text);
    const ctaSignals = [
      'se quiser',
      'posso',
      'quer',
      'vamos',
      'agendar',
      'reservar',
      'confirmar',
      'matricula',
      'pedido',
      'proximo passo',
      ...(scenario.ctaSignals ?? []),
    ];

    expect(ctaSignals.some((signal) => normalized.includes(signal))).toBe(true);
  }

  function expectScenarioContext(
    assistantMessage: string,
    scenario: LiveScenario,
  ) {
    const normalizedAssistant = normalizeText(assistantMessage);
    const matches = scenario.expectedContextSignals.filter((signal) =>
      normalizedAssistant.includes(normalizeText(signal)),
    );

    expect(matches.length).toBeGreaterThanOrEqual(scenario.minimumSignals);
  }

  async function ensureBillingReady(tenantId: string) {
    await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        plan: 'ESSENCIAL',
        status: 'ACTIVE',
        messagesQuota: 10000,
        aiTokensQuota: 2000000,
        contactsQuota: 5000,
        billingCycleStart: new Date('2026-04-01T00:00:00.000Z'),
        billingCycleEnd: new Date('2026-05-01T00:00:00.000Z'),
      },
      update: {
        status: 'ACTIVE',
        messagesQuota: 10000,
        aiTokensQuota: 2000000,
        contactsQuota: 5000,
      },
    });
  }

  async function seedScenarioData(tenantId: string, scenario: LiveScenario) {
    if (scenario.key === 'mercado') {
      const createCategory = app.get(CreateCatalogCategoryUseCase);
      const createItem = app.get(CreateCatalogItemUseCase);
      const syncInventory = app.get(SyncInventoryItemUseCase);

      const category = await createCategory.execute({
        tenantId,
        name: 'Mercearia',
      });

      const item = await createItem.execute({
        tenantId,
        categoryId: category.id,
        type: 'PRODUCT',
        name: 'Cafe torrado 500g',
        description: 'Cafe tradicional para o dia a dia',
        basePrice: '13.90',
        tags: ['cafe', 'mercado', '500g'],
      });

      await syncInventory.execute({
        tenantId,
        catalogItemId: item.id,
        sku: 'CAFE-500',
        externalReference: 'ERP-CAFE-500',
        name: 'Cafe torrado 500g',
        availableQuantity: 12,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '14.90',
        source: 'MANUAL_SNAPSHOT',
      });
    }

    if (scenario.key === 'barbearia') {
      const createCategory = app.get(CreateCatalogCategoryUseCase);
      const createItem = app.get(CreateCatalogItemUseCase);

      const category = await createCategory.execute({
        tenantId,
        name: 'Combos',
      });

      await createItem.execute({
        tenantId,
        categoryId: category.id,
        type: 'SERVICE',
        name: 'Combo Premium Noivo',
        description: 'Corte, barba e acabamento para eventos especiais',
        basePrice: '180.00',
        tags: ['casamento', 'noivo', 'premium'],
      });
    }

    if (scenario.key === 'clinica') {
      const createCategory = app.get(CreateSchedulingCategoryUseCase);
      const createProfessional = app.get(CreateSchedulingProfessionalUseCase);
      const assignCategories = app.get(AssignProfessionalCategoriesUseCase);
      const setAvailability = app.get(SetProfessionalAvailabilityUseCase);

      const category = await createCategory.execute({
        tenantId,
        name: 'Clareamento',
        unit: 'PER_SESSION',
        durationMinutes: 60,
      });

      const professional = await createProfessional.execute({
        tenantId,
        name: 'Dra. Ana',
        role: 'dentista',
      });

      await assignCategories.execute({
        tenantId,
        professionalId: professional.id,
        categoryIds: [category.id],
      });

      await setAvailability.execute({
        tenantId,
        professionalId: professional.id,
        date: getTomorrowDate(),
        slots: [
          {
            startsAt: '14:00',
            endsAt: '15:00',
            label: 'Clareamento',
          },
        ],
      });
    }
  }

  async function createScenarioTenant(scenario: LiveScenario, index: number) {
    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    const updateBusiness = app.get<IUpdateBusinessDataUseCase>(
      IUpdateBusinessDataUseCase,
    );

    const tenant = await createTenant.execute({
      companyName: scenario.companyName,
      cnpj: makeValidCnpj(Date.now() + index),
      ownerName: `${scenario.companyType} owner`,
      ownerEmail: `${scenario.companyType}-${Date.now()}-${index}@test.com`,
      ownerPhone: `11955554${String(index).padStart(3, '0')}`,
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });

    createdTenantIds.push(tenant.id);
    await ensureBillingReady(tenant.id);

    await configureAI.execute({
      tenantId: tenant.id,
      systemPrompt:
        'Voce e uma assistente comercial consultiva e sempre conduz a conversa para o proximo passo com naturalidade.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 400,
      confidenceThreshold: 0.65,
      businessRules: [
        'Sempre responder em portugues do Brasil.',
        'Usar contexto do negocio antes de ofertar.',
        'Sempre fechar com call to action.',
      ],
    });

    await updateBusiness.execute({
      tenantId: tenant.id,
      businessType: scenario.companyType,
      description: scenario.description,
      services: scenario.services,
      catalogUrl: `https://${scenario.companyType}.test/catalogo`,
      operatingHours: {
        monday: { open: '08:00', close: '18:00', closed: false },
        tuesday: { open: '08:00', close: '18:00', closed: false },
        wednesday: { open: '08:00', close: '18:00', closed: false },
        thursday: { open: '08:00', close: '18:00', closed: false },
        friday: { open: '08:00', close: '18:00', closed: false },
        saturday: { open: '08:00', close: '13:00', closed: false },
        sunday: { open: '08:00', close: '13:00', closed: true },
      },
    });

    await seedScenarioData(tenant.id, scenario);
    return tenant.id;
  }

  async function seedConversation(tenantId: string, scenario: LiveScenario) {
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: `Lead ${scenario.key}`,
        phone: `55119988${String(Date.now()).slice(-6)}`,
        stage: 'LEAD',
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    createdConversationIds.push(conversation.id);
    return { contactId: contact.id, conversationId: conversation.id };
  }

  beforeAll(async () => {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        'DEEPSEEK_API_KEY não configurada. Defina a chave antes de rodar RUN_REAL_AI_E2E=true.',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    processAI = app.get(IProcessAIResponseUseCase);
    chatHistory = app.get(CHAT_HISTORY_REPOSITORY);
  });

  afterEach(async () => {
    for (const conversationId of createdConversationIds) {
      await chatHistory.clearHistory(conversationId).catch(() => {});
    }
    createdConversationIds.length = 0;
  });

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      await prisma.message
        .deleteMany({
          where: {
            conversation: { tenantId },
          },
        })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.inventoryItem
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.catalogItem
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.catalogCategory
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.salesMetric
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.usageRecord
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.aIConfig.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  for (const [index, scenario] of scenarios.entries()) {
    it(`should map ${scenario.companyType} context with live AI for ${scenario.key}`, async () => {
      const tenantId = await createScenarioTenant(scenario, index + 1);
      const { contactId, conversationId } = await seedConversation(
        tenantId,
        scenario,
      );

      const result = await processAI.execute({
        tenantId,
        contactId,
        conversationId,
        content: { type: 'TEXT', text: scenario.inboundText },
      });

      const history = await chatHistory.getHistory(conversationId);
      const assistantMessage = history.at(-1)?.content ?? '';
      const normalizedAssistant = normalizeText(assistantMessage);

      if (!result.success) {
        throw new Error(
          [
            `Live AI falhou para o nicho "${scenario.companyType}".`,
            `Resultado: ${JSON.stringify(result)}`,
            `Ultima resposta salva: ${assistantMessage || '[vazia]'}`,
          ].join(' '),
        );
      }

      expect(assistantMessage.length).toBeGreaterThan(20);
      expect(normalizedAssistant).not.toContain('instabilidades tecnicas');
      expect(normalizedAssistant).not.toContain('especialista humano');
      expectScenarioContext(assistantMessage, scenario);
      expectCallToAction(assistantMessage, scenario);

      console.log(
        `\n[${scenario.companyType}] ${scenario.inboundText}\n=> ${assistantMessage}\n`,
      );
    });
  }
});
