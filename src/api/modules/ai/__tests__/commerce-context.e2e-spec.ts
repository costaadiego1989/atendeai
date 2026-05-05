import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '@modules/tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import { IUpdateBusinessDataUseCase } from '@modules/tenant/application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';
import { AI_ENGINE, IAIEngine } from '../application/ports/IAIEngine';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';
import { ConfigureShippingPolicyUseCase } from '@modules/commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import { StartShoppingSessionUseCase } from '@modules/commerce/application/use-cases/StartShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '@modules/commerce/application/use-cases/AddItemToShoppingSessionUseCase';
import { AIResponse } from '../application/ports/IAIEngine';

describe('Commerce AI context (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processAI: IProcessAIResponseUseCase;
  let tenantId: string;
  let capturedRequests: Array<{
    systemPrompt: string;
    userMessage: string;
  }> = [];
  const ownerEmail = `commerce-ai-owner-${Date.now()}@test.com`;

  const mockAiEngine: IAIEngine = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => {
      capturedRequests.push({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
      });

      return {
        text: 'Contexto comercial recebido e pronto para conduzir a compra.',
        tokensUsed: 32,
        confidence: 0.94,
        finishReason: 'stop',
        intent: 'QUESTION',
        sentiment: 'POSITIVE',
      };
    }),
  };

  const mockQuotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    })),
  };

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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_ENGINE)
      .useValue(mockAiEngine)
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(mockQuotaUseCase)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    processAI = app.get(IProcessAIResponseUseCase);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'Comercio Conversacional',
      cnpj: makeValidCnpj(Date.now()),
      ownerName: 'Owner Commerce AI',
      ownerEmail,
      ownerPhone: '11988887777',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
      businessType: 'MARKET',
    });

    tenantId = tenant.id;

    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    await configureAI.execute({
      tenantId,
      systemPrompt: 'You are a seller for a conversational commerce business.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 1200,
      confidenceThreshold: 0.5,
      escalationMessage: 'Vou transferir voce para um especialista humano.',
      businessRules: ['Conduzir sempre para o proximo passo concreto da compra'],
    });

    const updateBusiness = app.get<IUpdateBusinessDataUseCase>(
      IUpdateBusinessDataUseCase,
    );
    await updateBusiness.execute({
      tenantId,
      businessType: 'MARKET',
      description: 'Mercado de bairro com entrega e retirada.',
      services: 'Mercearia, bebidas, cafe da manha e itens do dia a dia',
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql(`
        DELETE FROM commerce_schema.orders WHERE tenant_id = '${tenantId}'::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql(`
        DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = '${tenantId}'::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql(`
        DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = '${tenantId}'::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql(`
        DELETE FROM commerce_schema.shipping_policies WHERE tenant_id = '${tenantId}'::uuid
      `).catch(() => { });
      await prisma.inventoryItem.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.catalogItem.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.catalogCategory.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.aIConfig.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    capturedRequests = [];
    jest.clearAllMocks();
  });

  it('should append numbered catalog matches for transactional catalog discovery', async () => {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);

    const category = await createCategory.execute({
      tenantId,
      name: 'Mercearia',
    });

    await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe torrado 500g',
      basePrice: '14.90',
      tags: ['cafe', 'bebida'],
    });

    await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe gourmet 250g',
      basePrice: '22.50',
      tags: ['cafe', 'gourmet'],
    });

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Mercado',
        phone: `5511996${String(Date.now()).slice(-7)}`,
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

    const result = await processAI.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      content: { type: 'TEXT', text: 'cafe' },
    });

    expect(result).toEqual({ success: true });
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.systemPrompt).toContain('Commerce flow context:');
    expect(capturedRequests[0]?.systemPrompt).toContain('Commerce catalog matches:');
    expect(capturedRequests[0]?.systemPrompt).toContain('Cafe torrado 500g');
    expect(capturedRequests[0]?.systemPrompt).toContain('Cafe gourmet 250g');
    expect(capturedRequests[0]?.systemPrompt).toContain('- 1.');
  });

  it('should append active shopping session context with cart, freight and total', async () => {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const syncInventory = app.get(SyncInventoryItemUseCase);
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);
    const startShoppingSession = app.get(StartShoppingSessionUseCase);
    const addItemToShoppingSession = app.get(AddItemToShoppingSessionUseCase);

    const category = await createCategory.execute({
      tenantId,
      name: 'Padaria',
    });

    const item = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Pao frances',
      basePrice: '1.50',
      tags: ['pao', 'padaria'],
    });

    const inventoryItem = await syncInventory.execute({
      tenantId,
      catalogItemId: item.id,
      sku: `PAO-${String(Date.now()).slice(-4)}`,
      name: 'Pao frances',
      availableQuantity: 50,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '1.50',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 8,
      notes: 'Entrega local',
    });

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Padaria',
        phone: `5511985${String(Date.now()).slice(-7)}`,
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

    const session = await startShoppingSession.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
    });

    await addItemToShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      inventoryItemId: inventoryItem.id,
      quantity: 4,
    });

    await prisma.$executeRaw(Prisma.sql(`
      UPDATE commerce_schema.shopping_sessions
      SET
        status = 'READY_FOR_CHECKOUT',
        fulfillment_type = 'DELIVERY',
        shipping_mode = 'FIXED',
        freight_amount = 8,
        subtotal_amount = 6,
        total_amount = 14,
        delivery_address = 'Rua das Flores, 100'
      WHERE id = '${session.id}'::uuid
    `);

    const result = await processAI.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      content: { type: 'TEXT', text: 'fechar pedido' },
    });

    expect(result).toEqual({ success: true });
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.systemPrompt).toContain('Shopping session context:');
    expect(capturedRequests[0]?.systemPrompt).toContain('Pao frances x4');
    expect(capturedRequests[0]?.systemPrompt).toContain('Freight: BRL 8.00');
    expect(capturedRequests[0]?.systemPrompt).toContain('Total: BRL 14.00');
  });

  it('should append shipping policy context with radius and delivery schedule', async () => {
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'PER_KM',
      pricePerKm: 4.5,
      minimumAmount: 12,
      maxRadiusKm: 8,
      deliverySchedule: [
        {
          weekday: 'MONDAY',
          enabled: true,
          startTime: '09:00',
          endTime: '18:00',
        },
        {
          weekday: 'SATURDAY',
          enabled: true,
          startTime: '09:00',
          endTime: '13:00',
        },
      ],
      notes: 'Entregas fora da cobertura precisam de validação manual.',
    });

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Entrega',
        phone: `5511974${String(Date.now()).slice(-7)}`,
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

    const result = await processAI.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      content: { type: 'TEXT', text: 'vocês entregam em copacabana?' },
    });

    expect(result).toEqual({ success: true });
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.systemPrompt).toContain('Shipping policy context:');
    expect(capturedRequests[0]?.systemPrompt).toContain('Shipping mode: PER_KM');
    expect(capturedRequests[0]?.systemPrompt).toContain('Freight per km: BRL 4.50');
    expect(capturedRequests[0]?.systemPrompt).toContain('Minimum freight amount: BRL 12.00');
    expect(capturedRequests[0]?.systemPrompt).toContain('Maximum delivery radius: 8 km');
    expect(capturedRequests[0]?.systemPrompt).toContain(
      'Delivery schedule: Monday 09:00-18:00, Saturday 09:00-13:00',
    );
    expect(capturedRequests[0]?.systemPrompt).toContain('Operational notes:');
  });
});
