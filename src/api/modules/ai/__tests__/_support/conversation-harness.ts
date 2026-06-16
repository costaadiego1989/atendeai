import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { AI_ENGINE } from '../../application/ports/IAIEngine';
import { PAYMENT_LINK_GENERATOR } from '../../application/ports/IPaymentLinkGenerator';
import { RESERVE_PROFESSIONAL_SLOT } from '../../application/ports/IReserveProfessionalSlot';
import { EMBEDDING_PROVIDER } from '../../application/ports/IEmbeddingProvider';
import { MediaUnderstandingService } from '../../application/services/MediaUnderstandingService';
import { BRANCH_ORIGIN_CEP_PORT } from '@modules/commerce/domain/ports/IBranchOriginCepPort';
import { QuoteCarrierShippingUseCase } from '@modules/commerce/application/use-cases/QuoteCarrierShippingUseCase';
import { AiSafetyGate } from '../../application/services/AiSafetyGate';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { PAYMENT_FACADE } from '@modules/payment/application/facades/IPaymentFacade';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureAIUseCase } from '@modules/tenant/application/use-cases/interfaces/IConfigureAIUseCase';
import { IUpdateBusinessDataUseCase } from '@modules/tenant/application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';
import { ConfigureShippingPolicyUseCase } from '@modules/commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import { ScriptedAiEngine } from './ScriptedAiEngine';
import { FakePaymentFacade } from './FakePaymentFacade';

export interface QuotaStub {
  execute: jest.Mock;
}

export interface ReserveSlotStub {
  execute: jest.Mock;
}

export interface PaymentLinkGeneratorStub {
  generate: jest.Mock;
}

export interface ConversationHarness {
  app: INestApplication;
  prisma: PrismaService;
  engine: ScriptedAiEngine;
  paymentFacade: FakePaymentFacade;
  quota: QuotaStub;
  reserveSlot: ReserveSlotStub;
  paymentLinkGenerator: PaymentLinkGeneratorStub;
  carrierQuote: { execute: jest.Mock };
  originCep: { getOriginCep: jest.Mock };
  mediaUnderstanding: { buildAiMessage: jest.Mock };
  safetyGate: { current: AiSafetyGate };
  /** Recorded integration events published during the test. */
  events: IntegrationEvent[];
  close(): Promise<void>;
}

/** Default safety gate: disabled (mirrors .env AI_SAFETY_MODE=false). */
function makeSafetyGate(
  override?: Partial<{
    safetyModeEnabled: boolean;
    blockedSubstrings: string[];
    platformSystemAppend: string;
  }>,
): AiSafetyGate {
  return new AiSafetyGate({
    safetyModeEnabled: override?.safetyModeEnabled ?? false,
    blockedSubstrings: override?.blockedSubstrings ?? [],
    platformSystemAppend: override?.platformSystemAppend ?? '',
  });
}

export async function bootConversationHarness(options?: {
  safety?: Parameters<typeof makeSafetyGate>[0];
}): Promise<ConversationHarness> {
  const engine = new ScriptedAiEngine();
  const paymentFacade = new FakePaymentFacade();

  const quota: QuotaStub = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 100000,
      status: 'ACTIVE',
    })),
  };

  const reserveSlot: ReserveSlotStub = {
    execute: jest.fn(async () => ({
      startsAt: '09:00',
      endsAt: '09:30',
      label: 'Serviço',
      status: 'RESERVED',
      reservedFor: { categoryName: 'Serviço' },
      payment: null,
    })),
  };

  const paymentLinkGenerator: PaymentLinkGeneratorStub = {
    generate: jest.fn(async () => ({
      id: 'fake-ai-link',
      url: 'https://pay.test/ai/1',
    })),
  };

  const safetyHolder = { current: makeSafetyGate(options?.safety) };

  const carrierQuote = {
    execute: jest.fn(async () => ({
      options: [
        {
          serviceCode: '04014',
          serviceName: 'SEDEX',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 3,
        },
        {
          serviceCode: '04510',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 18.0,
          deliveryDays: 7,
        },
      ],
    })),
  };

  const originCep = {
    getOriginCep: jest.fn(async () => '01001000'),
  };

  const mediaUnderstanding = {
    buildAiMessage: jest.fn(
      async (i: { text?: string }) =>
        `[conteudo de midia interpretado]${i.text ? ` ${i.text}` : ''}`,
    ),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AI_ENGINE)
    .useValue(engine)
    .overrideProvider(PAYMENT_FACADE)
    .useValue(paymentFacade)
    .overrideProvider(ICheckQuotaUseCase)
    .useValue(quota)
    .overrideProvider(RESERVE_PROFESSIONAL_SLOT)
    .useValue(reserveSlot)
    .overrideProvider(PAYMENT_LINK_GENERATOR)
    .useValue(paymentLinkGenerator)
    .overrideProvider(AiSafetyGate)
    .useValue(safetyHolder.current)
    .overrideProvider(EMBEDDING_PROVIDER)
    .useValue({
      generateEmbedding: jest.fn(async () => new Array(1536).fill(0)),
      generateEmbeddings: jest.fn(async (texts: string[]) =>
        texts.map(() => new Array(1536).fill(0)),
      ),
    })
    .overrideProvider(BRANCH_ORIGIN_CEP_PORT)
    .useValue(originCep)
    .overrideProvider(QuoteCarrierShippingUseCase)
    .useValue(carrierQuote)
    .overrideProvider(MediaUnderstandingService)
    .useValue(mediaUnderstanding)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);

  const events: IntegrationEvent[] = [];
  const eventBus = app.get<IEventBus>(EVENT_BUS);
  jest.spyOn(eventBus, 'publish').mockImplementation(async (event) => {
    events.push(event);
  });

  return {
    app,
    prisma,
    engine,
    paymentFacade,
    quota,
    reserveSlot,
    paymentLinkGenerator,
    carrierQuote,
    originCep,
    mediaUnderstanding,
    safetyGate: safetyHolder,
    events,
    async close() {
      await app.close();
    },
  };
}

let cnpjSeed = Date.now();
export function makeValidCnpj(): string {
  cnpjSeed += 1;
  const base = String(cnpjSeed).padStart(12, '0').slice(-12);
  const calcDigit = (digits: string, weights: number[]) => {
    const sum = digits
      .split('')
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calcDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

export interface SeededTenant {
  tenantId: string;
  ownerEmail: string;
}

export async function seedTenant(
  h: ConversationHarness,
  opts: {
    businessType: string;
    companyName?: string;
    description?: string;
    services?: string;
    systemPrompt?: string;
    confidenceThreshold?: number;
    escalationMessage?: string;
  },
): Promise<SeededTenant> {
  const ownerEmail = `conv-e2e-${opts.businessType}-${Date.now()}-${Math.floor(
    Math.random() * 1e6,
  )}@test.com`;

  const createTenant = h.app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
  const tenant = await createTenant.execute({
    companyName: opts.companyName ?? `E2E ${opts.businessType}`,
    cnpj: makeValidCnpj(),
    ownerName: 'Owner E2E',
    ownerEmail,
    ownerPhone: '11988887777',
    ownerPassword: 'SenhaForte123!',
    plan: 'ESSENCIAL',
    businessType: opts.businessType,
  });

  const configureAI = h.app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
  await configureAI.execute({
    tenantId: tenant.id,
    systemPrompt:
      opts.systemPrompt ?? 'Você é um atendente comercial da empresa.',
    tone: 'FRIENDLY',
    language: 'pt-BR',
    maxTokensPerResponse: 1200,
    confidenceThreshold: opts.confidenceThreshold ?? 0.5,
    escalationMessage:
      opts.escalationMessage ?? 'Vou transferir você para um especialista.',
    businessRules: ['Conduzir sempre para o próximo passo concreto.'],
  });

  const updateBusiness = h.app.get<IUpdateBusinessDataUseCase>(
    IUpdateBusinessDataUseCase,
  );
  await updateBusiness.execute({
    tenantId: tenant.id,
    businessType: opts.businessType,
    description: opts.description ?? 'Negócio de teste E2E.',
    services: opts.services ?? 'Atendimento, vendas e suporte.',
  });

  return { tenantId: tenant.id, ownerEmail };
}

export interface SeededCatalogItem {
  catalogItemId: string;
  inventoryItemId?: string;
}

export async function seedCatalogItem(
  h: ConversationHarness,
  opts: {
    tenantId: string;
    categoryId: string;
    name: string;
    basePrice: string;
    tags?: string[];
    stock?: number;
  },
): Promise<SeededCatalogItem> {
  const createItem = h.app.get(CreateCatalogItemUseCase);
  const item = await createItem.execute({
    tenantId: opts.tenantId,
    categoryId: opts.categoryId,
    type: 'PRODUCT',
    name: opts.name,
    basePrice: opts.basePrice,
    tags: opts.tags ?? [],
  });

  let inventoryItemId: string | undefined;
  if (opts.stock !== undefined) {
    const syncInventory = h.app.get(SyncInventoryItemUseCase);
    const inv = await syncInventory.execute({
      tenantId: opts.tenantId,
      catalogItemId: item.id,
      sku: `SKU-${item.id.slice(0, 8)}`,
      name: opts.name,
      currentPrice: opts.basePrice,
      availableQuantity: opts.stock,
      availabilityStatus: opts.stock > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
    });
    inventoryItemId = (inv as { id?: string })?.id;
  }

  return { catalogItemId: item.id, inventoryItemId };
}

export async function seedCategory(
  h: ConversationHarness,
  tenantId: string,
  name: string,
): Promise<string> {
  const createCategory = h.app.get(CreateCatalogCategoryUseCase);
  const category = await createCategory.execute({ tenantId, name });
  return category.id;
}

export async function seedFixedShipping(
  h: ConversationHarness,
  tenantId: string,
  fixedAmount = 10,
): Promise<void> {
  const configure = h.app.get(ConfigureShippingPolicyUseCase);
  await configure.execute({
    tenantId,
    mode: 'FIXED',
    fixedAmount,
    active: true,
    carrierShippingEnabled: false,
  } as never);
}

export async function seedCarrierShipping(
  h: ConversationHarness,
  tenantId: string,
  opts?: { mode?: 'FIXED' | 'PER_KM'; fixedAmount?: number },
): Promise<void> {
  const configure = h.app.get(ConfigureShippingPolicyUseCase);
  await configure.execute({
    tenantId,
    mode: opts?.mode ?? 'FIXED',
    fixedAmount: opts?.fixedAmount ?? 10,
    pricePerKm: opts?.mode === 'PER_KM' ? 2 : undefined,
    active: true,
    carrierShippingEnabled: true,
  } as never);
}

export async function seedCoupon(
  h: ConversationHarness,
  opts: {
    tenantId: string;
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    active?: boolean;
    maxUses?: number;
    usedCount?: number;
    startsAt?: Date;
    expiresAt?: Date | null;
  },
): Promise<void> {
  await h.prisma.salesCoupon.create({
    data: {
      tenantId: opts.tenantId,
      code: opts.code,
      discountType: opts.discountType,
      discountValue: opts.discountValue,
      maxUses: opts.maxUses ?? 0,
      usedCount: opts.usedCount ?? 0,
      startsAt: opts.startsAt ?? new Date(Date.now() - 86400000),
      expiresAt: opts.expiresAt ?? null,
      active: opts.active ?? true,
    },
  });
}

export async function getCommerceRepo(h: ConversationHarness) {
  const { COMMERCE_REPOSITORY } = await import(
    '@modules/commerce/domain/ports/ICommerceRepository'
  );
  return h.app.get<
    import('@modules/commerce/domain/ports/ICommerceRepository').ICommerceRepository
  >(COMMERCE_REPOSITORY);
}

export async function createConversation(
  h: ConversationHarness,
  tenantId: string,
): Promise<{ tenantId: string; contactId: string; conversationId: string }> {
  const contact = await h.prisma.contact.create({
    data: {
      tenantId,
      name: 'Cliente E2E',
      phone: `5511${String(Date.now()).slice(-9)}${Math.floor(
        Math.random() * 10,
      )}`,
      stage: 'LEAD',
    },
  });
  const conversation = await h.prisma.conversation.create({
    data: {
      tenantId,
      contactId: contact.id,
      channel: 'WHATSAPP',
      status: 'ACTIVE',
    },
  });
  return { tenantId, contactId: contact.id, conversationId: conversation.id };
}

/** Drive one inbound user message through the real ProcessAIResponse flow. */
export async function sendMessage(
  h: ConversationHarness,
  ctx: { tenantId: string; conversationId: string; contactId: string },
  text: string,
  opts?: { contextHints?: string[]; moduleId?: string },
) {
  const { IProcessAIResponseUseCase } = await import(
    '../../application/use-cases/interfaces/IProcessAIResponseUseCase'
  );
  const processAI = h.app.get(IProcessAIResponseUseCase);
  return processAI.execute({
    tenantId: ctx.tenantId,
    conversationId: ctx.conversationId,
    contactId: ctx.contactId,
    content: { type: 'TEXT', text },
    contextHints: opts?.contextHints,
    moduleId: opts?.moduleId,
  });
}

export async function getSession(
  h: ConversationHarness,
  tenantId: string,
  conversationId: string,
) {
  const { COMMERCE_REPOSITORY } = await import(
    '@modules/commerce/domain/ports/ICommerceRepository'
  );
  const repo = h.app.get<
    import('@modules/commerce/domain/ports/ICommerceRepository').ICommerceRepository
  >(COMMERCE_REPOSITORY);
  return repo.findActiveSessionByConversation(tenantId, conversationId);
}

/** Drive a non-text (media) inbound message through the real flow. */
export async function sendMedia(
  h: ConversationHarness,
  ctx: { tenantId: string; conversationId: string; contactId: string },
  content: { type: string; url?: string; text?: string; mimeType?: string },
) {
  const { IProcessAIResponseUseCase } = await import(
    '../../application/use-cases/interfaces/IProcessAIResponseUseCase'
  );
  const processAI = h.app.get(IProcessAIResponseUseCase);
  return processAI.execute({
    tenantId: ctx.tenantId,
    conversationId: ctx.conversationId,
    contactId: ctx.contactId,
    content,
  });
}

export function eventNames(events: IntegrationEvent[]): string[] {
  return events.map((e) => e.eventName);
}

export function hasEvent(events: IntegrationEvent[], name: string): boolean {
  return events.some((e) => e.eventName === name);
}

export function findEvent(
  events: IntegrationEvent[],
  name: string,
): IntegrationEvent | undefined {
  return events.find((e) => e.eventName === name);
}

/** Text the agent produced on the most recent successful turn (post tag-processing). */
export function lastGeneratedText(events: IntegrationEvent[]): string | null {
  const generated = events.filter(
    (e) => e.eventName === 'ai.response.generated.v1',
  );
  const last = generated[generated.length - 1];
  if (!last) return null;
  const payload = last.payload as { response?: { text?: string } };
  return payload.response?.text ?? null;
}

/** Best-effort per-tenant cleanup of rows created during a niche suite. */
export async function cleanupTenant(
  h: ConversationHarness,
  tenantId: string,
): Promise<void> {
  const p = h.prisma;
  const swallow = () => undefined;
  await p.$executeRawUnsafe(
    `DELETE FROM commerce_schema.orders WHERE tenant_id = '${tenantId}'::uuid`,
  ).catch(swallow);
  await p.$executeRawUnsafe(
    `DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = '${tenantId}'::uuid`,
  ).catch(swallow);
  await p.$executeRawUnsafe(
    `DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = '${tenantId}'::uuid`,
  ).catch(swallow);
  await p.$executeRawUnsafe(
    `DELETE FROM commerce_schema.shipping_policies WHERE tenant_id = '${tenantId}'::uuid`,
  ).catch(swallow);
  await p.inventoryItem.deleteMany({ where: { tenantId } }).catch(swallow);
  await p.catalogItem.deleteMany({ where: { tenantId } }).catch(swallow);
  await p.catalogCategory.deleteMany({ where: { tenantId } }).catch(swallow);
  await p.aIConfig.deleteMany({ where: { tenantId } }).catch(swallow);
  await p.user.deleteMany({ where: { tenantId } }).catch(swallow);
  await p.tenant.delete({ where: { id: tenantId } }).catch(swallow);
}
