/**
 * Niche Seed Fixtures
 *
 * Seed de dados por nicho: catálogo, scheduling, billing, WhatsApp config.
 * Cada nicho recebe dados realistas para que a IA tenha contexto adequado.
 */

import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { CreateCouponUseCase } from '@modules/sales/application/use-cases/CreateCouponUseCase';
import { AssignProfessionalCategoriesUseCase } from '@modules/scheduling/application/use-cases/AssignProfessionalCategoriesUseCase';
import { CreateSchedulingCategoryUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingCategoryUseCase';
import { CreateSchedulingProfessionalUseCase } from '@modules/scheduling/application/use-cases/CreateSchedulingProfessionalUseCase';
import { SetProfessionalAvailabilityUseCase } from '@modules/scheduling/application/use-cases/SetProfessionalAvailabilityUseCase';

import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface NicheConfig {
  businessType: string;
  label: string;
  description: string;
  services: string;
}

export interface SeedResult {
  couponCode: string;
  catalogCategoryId?: string;
  schedulingCategoryId?: string;
  professionalId?: string;
}

/**
 * Garante que o tenant tem billing ativo para os testes.
 */
export async function ensureBillingReady(
  prisma: PrismaService,
  tenantId: string,
): Promise<void> {
  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      plan: 'ESSENCIAL',
      status: 'ACTIVE',
      messagesQuota: 100000,
      aiTokensQuota: 5000000,
      contactsQuota: 100000,
      billingCycleStart: new Date('2026-04-01T00:00:00.000Z'),
      billingCycleEnd: new Date('2026-06-01T00:00:00.000Z'),
    },
    update: {
      status: 'ACTIVE',
      messagesQuota: 100000,
      aiTokensQuota: 5000000,
      contactsQuota: 100000,
      billingCycleEnd: new Date('2026-06-01T00:00:00.000Z'),
    },
  });
}

/**
 * Garante que o tenant tem WhatsApp config para receber webhooks.
 */
export async function ensureWhatsAppReady(
  prisma: PrismaService,
  tenantId: string,
): Promise<void> {
  const existing = await prisma.whatsAppConfig.findUnique({
    where: { tenantId },
  });

  if (existing) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const senderId =
    process.env.TWILIO_WHATSAPP_SENDER ||
    process.env.TWILIO_WHATSAPP_FROM ||
    'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    throw new Error(
      'Tenant has no WhatsApp config. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    );
  }

  await prisma.whatsAppConfig.create({
    data: {
      tenantId,
      provider: 'TWILIO',
      credentials: { accountSid, authToken, senderId },
      whatsappNumber: senderId.replace(/\D/g, ''),
      webhookSecret: null,
      status: 'ACTIVE',
    },
  });
}

/**
 * Atualiza o businessType e dados do tenant para o nicho sendo testado.
 * Usa update direto via Prisma para evitar o save completo do repositório
 * que pode falhar com colunas legadas.
 */
export async function updateBusinessForNiche(
  app: INestApplication,
  tenantId: string,
  niche: NicheConfig,
): Promise<void> {
  const prisma = app.get(PrismaService);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      businessType: niche.businessType,
      description: `${niche.description} Teste live por nicho: ${niche.label}.`,
      services: niche.services,
      catalogUrl: 'https://atendeai.test/catalogo-e2e',
      operatingHours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '20:00' },
        saturday: { open: '09:00', close: '14:00' },
      },
    },
  });

  // Ensure aiConfig exists with appropriate threshold
  await prisma.aIConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      systemPrompt: `Você é o assistente virtual de ${niche.label}. Responda sempre em português, com base apenas nas informações fornecidas. Nunca invente preços ou serviços.`,
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 500,
      confidenceThreshold: 0.3,
      businessRules: [
        'Sempre responda em português brasileiro',
        'Use apenas informações fornecidas no contexto',
        'Nunca invente preços ou produtos',
        'Ofereça link de pagamento quando cliente confirmar compra',
        'Se o cliente pedir para voltar ao menu, apresente as opções novamente',
      ],
      salesInstructions: 'Identifique intenção de compra e ofereça link de pagamento via PIX.',
    },
    update: {
      confidenceThreshold: 0.3,
      businessRules: [
        'Sempre responda em português brasileiro',
        'Use apenas informações fornecidas no contexto',
        'Nunca invente preços ou produtos',
        'Ofereça link de pagamento quando cliente confirmar compra',
        'Se o cliente pedir para voltar ao menu, apresente as opções novamente',
      ],
    },
  });
}

/**
 * Seed de catálogo para nichos COMMERCE.
 */
export async function seedCommerceFixtures(
  app: INestApplication,
  tenantId: string,
): Promise<{ categoryId: string; couponCode: string }> {
  const createCategory = app.get(CreateCatalogCategoryUseCase);
  const createItem = app.get(CreateCatalogItemUseCase);

  const suffix = String(Date.now()).slice(-5);

  const category = await createCategory.execute({
    tenantId,
    name: `Produtos E2E ${suffix}`,
    description: 'Produtos para testes de integração por nicho',
  });

  await createItem.execute({
    tenantId,
    categoryId: category.id,
    type: 'PRODUCT',
    name: 'Cafe 500g E2E',
    description: 'Cafe torrado 500g para compra por conversa',
    basePrice: '18.90',
    currency: 'BRL',
    tags: ['cafe', '500g', 'mercearia', 'delivery', 'padaria'],
    initialStock: 50,
    attributes: { teste: 'niche-integration' },
  });

  await createItem.execute({
    tenantId,
    categoryId: category.id,
    type: 'PRODUCT',
    name: 'Bolo de cenoura E2E',
    description: 'Bolo de cenoura para pedido de delivery',
    basePrice: '32.00',
    currency: 'BRL',
    tags: ['bolo', 'cenoura', 'padaria', 'delivery', 'cafeteria'],
    initialStock: 30,
    optionGroups: [
      {
        name: 'Adicionais',
        required: false,
        options: [
          { name: 'Cobertura extra', price: 5 },
          { name: 'Granulado', price: 3 },
        ],
      },
    ],
  });

  await createItem.execute({
    tenantId,
    categoryId: category.id,
    type: 'PRODUCT',
    name: 'Camiseta Dry Fit E2E',
    description: 'Camiseta esportiva para varejo',
    basePrice: '59.90',
    currency: 'BRL',
    tags: ['camiseta', 'dry fit', 'esporte', 'varejo', 'retail'],
    initialStock: 100,
  });

  await createItem.execute({
    tenantId,
    categoryId: category.id,
    type: 'PRODUCT',
    name: 'Arroz 5kg E2E',
    description: 'Arroz tipo 1 para supermercado',
    basePrice: '24.90',
    currency: 'BRL',
    tags: ['arroz', '5kg', 'supermercado', 'mercado', 'mercearia'],
    initialStock: 200,
  });

  const couponCode = await seedCoupon(app, tenantId);

  return { categoryId: category.id, couponCode };
}

/**
 * Seed de scheduling para nichos SCHEDULING.
 */
export async function seedSchedulingFixtures(
  app: INestApplication,
  tenantId: string,
): Promise<{ categoryId: string; professionalId: string }> {
  const createCategory = app.get(CreateSchedulingCategoryUseCase);
  const createProfessional = app.get(CreateSchedulingProfessionalUseCase);
  const assignCategories = app.get(AssignProfessionalCategoriesUseCase);
  const setAvailability = app.get(SetProfessionalAvailabilityUseCase);

  const suffix = String(Date.now()).slice(-5);

  const category = await createCategory.execute({
    tenantId,
    name: `Avaliacao E2E ${suffix}`,
    unit: 'PER_SESSION',
    durationMinutes: 60,
    basePrice: 120,
  });

  const professional = await createProfessional.execute({
    tenantId,
    name: 'Dra Ana E2E',
    phone: '11999990000',
    role: 'especialista',
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
      { startsAt: '09:00', endsAt: '10:00', label: 'Avaliacao E2E', isOnline: true },
      { startsAt: '10:00', endsAt: '11:00', label: 'Avaliacao E2E', isOnline: true },
      { startsAt: '14:00', endsAt: '15:00', label: 'Avaliacao E2E', isOnline: true },
      { startsAt: '16:00', endsAt: '17:00', label: 'Avaliacao E2E', isOnline: false },
    ],
  });

  return { categoryId: category.id, professionalId: professional.id };
}

/**
 * Cria um cupom de desconto para testes de commerce.
 */
async function seedCoupon(
  app: INestApplication,
  tenantId: string,
): Promise<string> {
  const code = `NICHE${String(Date.now()).slice(-6)}`;
  const createCoupon = app.get(CreateCouponUseCase);

  await createCoupon.execute({
    tenantId,
    code,
    description: 'Cupom E2E para testes de integração por nicho',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUses: 0,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });

  return code;
}

/**
 * Salva snapshot do tenant para restaurar após os testes.
 */
export async function saveTenantSnapshot(
  prisma: PrismaService,
  tenantId: string,
): Promise<{
  tenant: Record<string, any>;
  whatsApp: Record<string, any> | null;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const whatsApp = await prisma.whatsAppConfig.findUnique({
    where: { tenantId },
  });

  return {
    tenant: {
      businessType: tenant.businessType,
      description: tenant.description,
      services: tenant.services,
      catalogUrl: tenant.catalogUrl,
      operatingHours: tenant.operatingHours,
    },
    whatsApp: whatsApp
      ? {
          id: whatsApp.id,
          provider: whatsApp.provider,
          credentials: whatsApp.credentials,
          whatsappNumber: whatsApp.whatsappNumber,
          webhookSecret: whatsApp.webhookSecret,
          status: whatsApp.status,
        }
      : null,
  };
}

/**
 * Restaura o tenant ao estado original após os testes.
 */
export async function restoreTenantSnapshot(
  prisma: PrismaService,
  tenantId: string,
  snapshot: { tenant: Record<string, any>; whatsApp: Record<string, any> | null },
): Promise<void> {
  await prisma.tenant
    .update({ where: { id: tenantId }, data: snapshot.tenant as any })
    .catch(() => {});

  if (snapshot.whatsApp) {
    await prisma.whatsAppConfig
      .upsert({
        where: { tenantId },
        create: {
          tenantId,
          provider: snapshot.whatsApp.provider,
          credentials: snapshot.whatsApp.credentials as any,
          whatsappNumber: snapshot.whatsApp.whatsappNumber,
          webhookSecret: snapshot.whatsApp.webhookSecret,
          status: snapshot.whatsApp.status,
        },
        update: {
          provider: snapshot.whatsApp.provider,
          credentials: snapshot.whatsApp.credentials as any,
          whatsappNumber: snapshot.whatsApp.whatsappNumber,
          webhookSecret: snapshot.whatsApp.webhookSecret,
          status: snapshot.whatsApp.status,
        },
      })
      .catch(() => {});
  } else {
    await prisma.whatsAppConfig
      .delete({ where: { tenantId } })
      .catch(() => {});
  }
}

function getTomorrowDate(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.toISOString().slice(0, 10);
}
