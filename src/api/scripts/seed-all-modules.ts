import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TENANT_ID = '931d416d-3981-4391-adad-e927641cfb93';
const SEED_TAG = 'SEED-ALL';

// Pre-generated IDs for cross-references
const USER_IDS = {
  admin: randomUUID(),
  manager: randomUUID(),
  agent: randomUUID(),
};

const BRANCH_IDS = {
  headquarters: randomUUID(),
  branch: randomUUID(),
};

const CONTACT_IDS = Array.from({ length: 15 }, () => randomUUID());
const CONVERSATION_IDS = Array.from({ length: 8 }, () => randomUUID());
const CATALOG_CATEGORY_IDS = {
  alimentos: randomUUID(),
  bebidas: randomUUID(),
  sobremesas: randomUUID(),
};
const CATALOG_ITEM_IDS = Array.from({ length: 10 }, () => randomUUID());
const AI_SESSION_IDS = Array.from({ length: 3 }, () => randomUUID());
const SOCIAL_ACCOUNT_ID = randomUUID();
const SOCIAL_POST_IDS = Array.from({ length: 3 }, () => randomUUID());

// Brazilian data
const NAMES = [
  'Maria Silva', 'João Santos', 'Ana Oliveira', 'Pedro Costa', 'Juliana Souza',
  'Carlos Ferreira', 'Fernanda Lima', 'Lucas Almeida', 'Beatriz Rodrigues', 'Rafael Pereira',
  'Camila Nascimento', 'Thiago Barbosa', 'Larissa Carvalho', 'Gustavo Ribeiro', 'Patrícia Gomes',
];

const PHONES = [
  '5511987654321', '5511976543210', '5521965432109', '5521954321098', '5531943210987',
  '5531932109876', '5541921098765', '5541910987654', '5548909876543', '5548998765432',
  '5551987654320', '5551976543219', '5561965432108', '5561954321097', '5571943210986',
];

const STAGES = ['LEAD', 'LEAD', 'PROSPECT', 'PROSPECT', 'CUSTOMER', 'CUSTOMER', 'CUSTOMER',
  'CUSTOMER', 'CUSTOMER', 'INACTIVE', 'LEAD', 'PROSPECT', 'CUSTOMER', 'CUSTOMER', 'LEAD'];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

// ─── CLEANUP ───────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('🧹 Limpando dados anteriores do seed...');

  // AI
  await prisma.aIMessage.deleteMany({ where: { session: { tenantId: TENANT_ID } } });
  await prisma.aISession.deleteMany({ where: { tenantId: TENANT_ID } });

  // Messaging
  await prisma.message.deleteMany({ where: { conversation: { tenantId: TENANT_ID } } });
  await prisma.conversationIntelligence.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.conversation.deleteMany({ where: { tenantId: TENANT_ID } });

  // Sales
  await prisma.conversationSaleEvent.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.proposal.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.salesCoupon.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.salesPromotion.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.paymentLink.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.salesMetric.deleteMany({ where: { tenantId: TENANT_ID } });

  // Commission
  await prisma.tenantUserSalesProfile.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenantSalesCommissionDefaults.deleteMany({ where: { tenantId: TENANT_ID } });

  // Recovery
  await prisma.recoveryCase.deleteMany({ where: { tenantId: TENANT_ID } });

  // Prospecting
  await prisma.prospectSearchResult.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.prospectSearch.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.prospectLeadCapture.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.prospectExecution.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.prospectCampaign.deleteMany({ where: { tenantId: TENANT_ID } });

  // Social
  await prisma.socialCommentReply.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.socialComment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.socialPost.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.socialAutoReplyRule.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.socialInboxThread.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.socialAccount.deleteMany({ where: { tenantId: TENANT_ID } });

  // Support
  await prisma.supportFeedbackReply.deleteMany({ where: { feedback: { tenantId: TENANT_ID } } });
  await prisma.supportFeedback.deleteMany({ where: { tenantId: TENANT_ID } });

  // Scheduling (PG)
  await prisma.schedulingRecurringReservationRun.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.schedulingRecurringReservation.deleteMany({ where: { tenantId: TENANT_ID } });

  // Inventory & Catalog
  await prisma.inventoryItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.catalogItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.catalogCategory.deleteMany({ where: { tenantId: TENANT_ID } });

  // Commerce (raw SQL — tables may not exist yet)
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM commerce_schema.orders WHERE tenant_id = '${TENANT_ID}'`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = '${TENANT_ID}'`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = '${TENANT_ID}'`,
    );
  } catch {
    // Tables don't exist yet — will be created in seedCommerce
  }
  await prisma.commerceAbandonmentConfig.deleteMany({ where: { tenantId: TENANT_ID } });

  // Billing
  await prisma.usageRecord.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.subscriptionModule.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.subscription.deleteMany({ where: { tenantId: TENANT_ID } });

  // Agent Rules
  await prisma.tenantAgentRule.deleteMany({ where: { tenantId: TENANT_ID } });

  // Contacts
  await prisma.contact.deleteMany({ where: { tenantId: TENANT_ID } });

  // Users
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });

  // Branches
  await prisma.$executeRawUnsafe(
    `DELETE FROM tenant_schema.tenant_branches WHERE tenant_id = '${TENANT_ID}'::uuid`,
  );

  // Tenant configs
  await prisma.whatsAppConfig.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.aIConfig.deleteMany({ where: { tenantId: TENANT_ID } });

  console.log('✅ Cleanup concluído');
}

// ─── SEED TENANT ───────────────────────────────────────────────────────────────
async function seedTenant() {
  console.log('🏢 Configurando tenant...');

  await prisma.tenant.update({
    where: { id: TENANT_ID },
    data: {
      companyName: 'Sabor & Cia Restaurante',
      businessType: 'RESTAURANTE',
      plan: 'PROFESSIONAL',
      planStatus: 'ACTIVE',
      description: 'Restaurante e delivery de comida brasileira',
      services: 'Delivery, Retirada, Reservas, Eventos',
      city: 'São Paulo',
      state: 'SP',
      street: 'Rua Augusta',
      streetNumber: '1200',
      neighborhood: 'Consolação',
      zipcode: '01304-001',
      operatingHours: {
        monday: { open: '08:00', close: '22:00' },
        tuesday: { open: '08:00', close: '22:00' },
        wednesday: { open: '08:00', close: '22:00' },
        thursday: { open: '08:00', close: '22:00' },
        friday: { open: '08:00', close: '23:00' },
        saturday: { open: '09:00', close: '23:00' },
        sunday: { open: '09:00', close: '20:00' },
      },
    },
  });

  await prisma.whatsAppConfig.create({
    data: {
      tenantId: TENANT_ID,
      provider: 'BUBBLEWHATS',
      whatsappNumber: '5511999887766',
      status: 'ACTIVE',
      credentials: { apiKey: 'seed-fake-key', instanceId: 'seed-instance' },
    },
  });

  await prisma.aIConfig.create({
    data: {
      tenantId: TENANT_ID,
      systemPrompt: `Você é o assistente virtual do Sabor & Cia Restaurante. Ajude os clientes com pedidos, cardápio, reservas e dúvidas. Seja cordial e objetivo.`,
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 600,
      confidenceThreshold: 0.75,
      escalationMessage: 'Vou transferir você para um atendente humano. Um momento!',
      businessRules: JSON.stringify([
        'Horário de delivery: 11h às 22h',
        'Pedido mínimo para delivery: R$ 30,00',
        'Taxa de entrega: R$ 8,00 até 5km',
      ]),
      salesInstructions: 'Sempre sugira combos e sobremesas. Ofereça cupom de primeira compra.',
    },
  });

  await prisma.$executeRawUnsafe(`
    INSERT INTO tenant_schema.tenant_branches (id, tenant_id, name, phone, email, city, state, is_headquarters, active)
    VALUES
      ('${BRANCH_IDS.headquarters}', '${TENANT_ID}', 'Matriz - Consolação', '5511999887766', 'contato@saborecia.com.br', 'São Paulo', 'SP', true, true),
      ('${BRANCH_IDS.branch}', '${TENANT_ID}', 'Filial - Pinheiros', '5511988776655', 'pinheiros@saborecia.com.br', 'São Paulo', 'SP', false, true)
  `);

  console.log('✅ Tenant configurado');
}

// ─── SEED USERS ────────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('👤 Criando usuários...');
  const hash = await bcrypt.hash('Test@123', 10);
  const tenantSlug = TENANT_ID.slice(0, 8);

  const users = [
    { id: USER_IDS.admin, tenantId: TENANT_ID, name: 'Roberto Administrador', email: `seed-admin-${tenantSlug}@saborecia.com.br`, phone: '5511999000001', passwordHash: hash, mustChangePassword: false, role: 'ADMIN' },
    { id: USER_IDS.manager, tenantId: TENANT_ID, name: 'Carla Gerente', email: `seed-manager-${tenantSlug}@saborecia.com.br`, phone: '5511999000002', passwordHash: hash, mustChangePassword: false, role: 'MANAGER' },
    { id: USER_IDS.agent, tenantId: TENANT_ID, name: 'Felipe Atendente', email: `seed-agent-${tenantSlug}@saborecia.com.br`, phone: '5511999000003', passwordHash: hash, mustChangePassword: false, role: 'AGENT' },
  ];

  for (const user of users) {
    await prisma.user.create({ data: user });
  }
  console.log(`✅ Usuários criados (senha: Test@123, emails: seed-*-${tenantSlug}@saborecia.com.br)`);
}

// ─── SEED CONTACTS ─────────────────────────────────────────────────────────────
async function seedContacts() {
  console.log('📇 Criando contatos...');
  const tags = [
    ['vip', 'delivery'], ['novo'], ['recorrente', 'fiel'], ['delivery'],
    ['evento'], ['corporativo'], ['indicação'], ['recorrente'],
    ['vip'], ['inativo'], ['novo', 'instagram'], ['delivery', 'promo'],
    ['fiel', 'vip'], ['corporativo', 'evento'], ['novo'],
  ];

  for (let i = 0; i < 15; i++) {
    await prisma.contact.create({
      data: {
        id: CONTACT_IDS[i],
        tenantId: TENANT_ID,
        name: NAMES[i],
        phone: PHONES[i],
        email: i < 10 ? `${NAMES[i].split(' ')[0].toLowerCase()}@email.com` : undefined,
        stage: STAGES[i],
        tags: tags[i],
        notes: i % 3 === 0 ? 'Cliente frequente, prefere pagamento via PIX' : undefined,
        lastInteraction: i < 12 ? hoursAgo(i * 8 + 2) : undefined,
      },
    });
  }
  console.log('✅ 15 contatos criados');
}

// ─── SEED MESSAGING ────────────────────────────────────────────────────────────
async function seedMessaging() {
  console.log('💬 Criando conversas e mensagens...');
  const convStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'WAITING_REPLY', 'WAITING_REPLY', 'CLOSED', 'CLOSED', 'ACTIVE'];

  for (let i = 0; i < 8; i++) {
    const convId = CONVERSATION_IDS[i];
    const contactId = CONTACT_IDS[i];
    const status = convStatuses[i];
    const startedAt = hoursAgo(48 - i * 5);

    await prisma.conversation.create({
      data: {
        id: convId,
        tenantId: TENANT_ID,
        contactId,
        branchId: i < 5 ? BRANCH_IDS.headquarters : BRANCH_IDS.branch,
        channel: 'WHATSAPP',
        status,
        assignedUserId: i % 3 === 0 ? USER_IDS.agent : undefined,
        assignedAt: i % 3 === 0 ? hoursAgo(24) : undefined,
        unreadCount: status === 'ACTIVE' ? (i % 4) + 1 : 0,
        lastInboundAt: hoursAgo(i * 2 + 1),
        lastOutboundAt: hoursAgo(i * 2),
        lastMessageAt: hoursAgo(i * 2),
        lastMessageDirection: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
        lastMessagePreview: i % 2 === 0 ? 'Olá, gostaria de fazer um pedido' : 'Seu pedido está a caminho!',
        startedAt,
        closedAt: status === 'CLOSED' ? hoursAgo(i) : undefined,
      },
    });

    const msgCount = 3 + (i % 6);
    const messageTemplates = [
      { dir: 'INBOUND', type: 'TEXT', content: { text: 'Olá, boa tarde!' }, by: 'USER' },
      { dir: 'OUTBOUND', type: 'TEXT', content: { text: 'Olá! Bem-vindo ao Sabor & Cia. Como posso ajudar?' }, by: 'AI' },
      { dir: 'INBOUND', type: 'TEXT', content: { text: 'Quero ver o cardápio de hoje' }, by: 'USER' },
      { dir: 'OUTBOUND', type: 'TEXT', content: { text: 'Temos pratos executivos a partir de R$ 25,90.' }, by: 'AI' },
      { dir: 'INBOUND', type: 'TEXT', content: { text: 'Sim, por favor!' }, by: 'USER' },
      { dir: 'OUTBOUND', type: 'IMAGE', content: { url: 'https://example.com/cardapio.jpg', caption: 'Cardápio do dia' }, by: 'AI' },
      { dir: 'INBOUND', type: 'TEXT', content: { text: 'Quero o combo 2 com suco de laranja' }, by: 'USER' },
      { dir: 'OUTBOUND', type: 'TEXT', content: { text: 'Perfeito! Total: R$ 35,90. Confirma?' }, by: 'USER' },
    ];

    for (let m = 0; m < msgCount; m++) {
      const tpl = messageTemplates[m % messageTemplates.length];
      await prisma.message.create({
        data: {
          conversationId: convId,
          direction: tpl.dir,
          contentType: tpl.type,
          content: tpl.content,
          sentBy: tpl.by,
          deliveryStatus: 'DELIVERED',
          sortOrder: BigInt((i * 100) + m + 1),
          createdAt: new Date(startedAt.getTime() + m * 3 * 60 * 1000),
        },
      });
    }
  }

  // Conversation Intelligence
  const sentiments = ['POSITIVE', 'NEUTRAL', 'POSITIVE', 'NEGATIVE'];
  for (let i = 0; i < 4; i++) {
    await prisma.conversationIntelligence.create({
      data: {
        tenantId: TENANT_ID,
        conversationId: CONVERSATION_IDS[i],
        sentiment: sentiments[i],
        tags: ['pedido', 'delivery'],
        interests: ['combo', 'promoção'],
        summary: `Cliente ${NAMES[i]} interessado em fazer pedido via delivery.`,
        nextStep: i < 2 ? 'Enviar confirmação do pedido' : 'Aguardar retorno do cliente',
      },
    });
  }
  console.log('✅ 8 conversas com mensagens criadas');
}

// ─── SEED AI ───────────────────────────────────────────────────────────────────
async function seedAI() {
  console.log('🤖 Criando sessões de IA...');
  for (let i = 0; i < 3; i++) {
    const sessionId = AI_SESSION_IDS[i];
    await prisma.aISession.create({
      data: {
        id: sessionId,
        tenantId: TENANT_ID,
        conversationId: CONVERSATION_IDS[i],
        contactId: CONTACT_IDS[i],
        intent: ['ORDER', 'QUESTION', 'SUPPORT'][i],
        sentiment: ['POSITIVE', 'NEUTRAL', 'NEUTRAL'][i],
        confidence: [0.92, 0.85, 0.78][i],
        status: 'COMPLETED',
        totalTokens: [450, 320, 580][i],
      },
    });

    const aiMsgs = [
      { role: 'system', content: 'Você é o assistente do Sabor & Cia.' },
      { role: 'user', content: 'Quero fazer um pedido' },
      { role: 'assistant', content: 'Claro! O que gostaria de pedir hoje?' },
      { role: 'user', content: 'Um combo executivo' },
      { role: 'assistant', content: 'Temos o combo 1 (frango) por R$25,90 e combo 2 (picanha) por R$35,90.' },
      { role: 'user', content: 'Combo 2 por favor' },
    ];

    const msgCount = 4 + (i % 3);
    for (let m = 0; m < msgCount; m++) {
      const msg = aiMsgs[m % aiMsgs.length];
      await prisma.aIMessage.create({
        data: { sessionId, role: msg.role, content: msg.content, tokens: 20 + m * 15 },
      });
    }
  }
  console.log('✅ 3 sessões de IA criadas');
}

// ─── SEED CATALOG ──────────────────────────────────────────────────────────────
async function seedCatalog() {
  console.log('📦 Criando catálogo...');
  const categories = [
    { id: CATALOG_CATEGORY_IDS.alimentos, name: 'Alimentos', description: 'Pratos principais e acompanhamentos' },
    { id: CATALOG_CATEGORY_IDS.bebidas, name: 'Bebidas', description: 'Sucos, refrigerantes e drinks' },
    { id: CATALOG_CATEGORY_IDS.sobremesas, name: 'Sobremesas', description: 'Doces e sobremesas artesanais' },
  ];

  for (const cat of categories) {
    await prisma.catalogCategory.create({
      data: { id: cat.id, tenantId: TENANT_ID, name: cat.name, description: cat.description, active: true },
    });
  }

  const items = [
    { name: 'Combo Executivo Frango', price: 25.90, cat: 'alimentos' },
    { name: 'Combo Executivo Picanha', price: 35.90, cat: 'alimentos' },
    { name: 'Feijoada Completa', price: 42.00, cat: 'alimentos' },
    { name: 'Marmitex GG', price: 22.00, cat: 'alimentos' },
    { name: 'Coxinha de Frango (6un)', price: 18.00, cat: 'alimentos' },
    { name: 'Suco Natural 500ml', price: 12.00, cat: 'bebidas' },
    { name: 'Refrigerante Lata', price: 7.50, cat: 'bebidas' },
    { name: 'Água de Coco 300ml', price: 8.00, cat: 'bebidas' },
    { name: 'Pudim de Leite', price: 14.00, cat: 'sobremesas' },
    { name: 'Brownie com Sorvete', price: 18.00, cat: 'sobremesas' },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const catId = CATALOG_CATEGORY_IDS[item.cat as keyof typeof CATALOG_CATEGORY_IDS];
    await prisma.catalogItem.create({
      data: {
        id: CATALOG_ITEM_IDS[i],
        tenantId: TENANT_ID,
        categoryId: catId,
        name: item.name,
        type: 'PRODUCT',
        basePrice: item.price,
        currency: 'BRL',
        active: true,
        source: 'MANUAL',
        attributes: {},
        variants: [],
        optionGroups: [],
      },
    });
  }
  console.log('✅ 3 categorias e 10 itens de catálogo criados');
}

// ─── SEED INVENTORY ────────────────────────────────────────────────────────────
async function seedInventory() {
  console.log('📊 Criando inventário...');
  const skus = ['ALM-001', 'ALM-002', 'ALM-003', 'ALM-004', 'ALM-005', 'BEB-001', 'BEB-002', 'SOB-001'];
  const quantities = [50, 30, 20, 80, 45, 100, 120, 25];

  for (let i = 0; i < 8; i++) {
    await prisma.inventoryItem.create({
      data: {
        tenantId: TENANT_ID,
        catalogItemId: CATALOG_ITEM_IDS[i],
        sku: skus[i],
        name: `Estoque - ${skus[i]}`,
        availableQuantity: quantities[i],
        availabilityStatus: quantities[i] > 10 ? 'IN_STOCK' : 'LOW_STOCK',
        source: 'MANUAL',
      },
    });
  }
  console.log('✅ 8 itens de inventário criados');
}

// ─── SEED COMMERCE ─────────────────────────────────────────────────────────────
async function seedCommerce() {
  console.log('🛒 Criando dados de commerce...');

  // Ensure commerce schema and tables exist
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS commerce_schema`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS commerce_schema.shopping_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      branch_id UUID,
      conversation_id UUID NOT NULL,
      contact_id UUID,
      status VARCHAR(30) NOT NULL DEFAULT 'BUILDING_CART',
      current_step VARCHAR(40) NOT NULL DEFAULT 'IDENTIFYING_NEED',
      fulfillment_type VARCHAR(20),
      shipping_mode VARCHAR(20),
      distance_km NUMERIC(10, 2),
      freight_amount NUMERIC(12, 2),
      subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      delivery_address TEXT,
      notes TEXT,
      payment_reference VARCHAR(255),
      payment_link_id VARCHAR(80),
      payment_link_url TEXT,
      payment_status VARCHAR(20),
      checked_out_at TIMESTAMPTZ,
      pending_query TEXT,
      pending_options JSONB,
      selected_source VARCHAR(20),
      selected_inventory_item_id UUID,
      selected_catalog_item_id UUID,
      selected_item_name VARCHAR(255),
      abandonment_paused BOOLEAN NOT NULL DEFAULT FALSE,
      abandonment_paused_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS commerce_schema.shopping_session_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES commerce_schema.shopping_sessions(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL,
      source VARCHAR(20) NOT NULL,
      inventory_item_id UUID,
      catalog_item_id UUID,
      name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price NUMERIC(12, 2),
      currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
      line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS commerce_schema.orders (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      branch_id UUID,
      session_id UUID NOT NULL UNIQUE REFERENCES commerce_schema.shopping_sessions(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL,
      contact_id UUID,
      status VARCHAR(30) NOT NULL,
      fulfillment_type VARCHAR(20),
      shipping_mode VARCHAR(20),
      subtotal_amount NUMERIC(12, 2) NOT NULL,
      freight_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL,
      delivery_address TEXT,
      payment_reference VARCHAR(255) UNIQUE,
      payment_link_id VARCHAR(80),
      payment_link_url TEXT,
      payment_status VARCHAR(20),
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.commerceAbandonmentConfig.create({
    data: {
      tenantId: TENANT_ID,
      active: true,
      useAiMessage: true,
      mode: 'SEQUENTIAL',
      maxTouches: 3,
      intervalMinutes: 60,
      minimumIntervalMinutes: 15,
    },
  });

  const sessionStatuses = ['PAID', 'PAID', 'PAID', 'AWAITING_PAYMENT', 'BUILDING_CART'];
  const orderStatuses = ['DELIVERED', 'PREPARING', 'PAID'];

  for (let i = 0; i < 5; i++) {
    const sessionId = randomUUID();
    const conversationId = i < 3 ? CONVERSATION_IDS[i] : randomUUID();
    const contactId = CONTACT_IDS[i];
    const subtotal = (30 + i * 15).toFixed(2);
    const freight = '8.00';
    const total = (30 + i * 15 + 8).toFixed(2);

    await prisma.$executeRawUnsafe(`
      INSERT INTO commerce_schema.shopping_sessions (
        id, tenant_id, branch_id, conversation_id, contact_id, status, current_step,
        fulfillment_type, shipping_mode, freight_amount, subtotal_amount, total_amount,
        created_at, updated_at
      ) VALUES (
        '${sessionId}', '${TENANT_ID}', '${BRANCH_IDS.headquarters}', '${conversationId}',
        '${contactId}', '${sessionStatuses[i]}', 'READY_FOR_CHECKOUT',
        'DELIVERY', 'FIXED', ${freight}, ${subtotal}, ${total},
        now() - interval '${i + 1} days', now() - interval '${i} days'
      )
    `);

    for (let j = 0; j < 2; j++) {
      const itemIdx = (i * 2 + j) % CATALOG_ITEM_IDS.length;
      await prisma.$executeRawUnsafe(`
        INSERT INTO commerce_schema.shopping_session_items (
          session_id, tenant_id, source, catalog_item_id, name, quantity, unit_price, currency, line_total
        ) VALUES (
          '${sessionId}', '${TENANT_ID}', 'CATALOG', '${CATALOG_ITEM_IDS[itemIdx]}',
          '${['Combo Frango', 'Suco Natural', 'Feijoada', 'Refrigerante', 'Pudim', 'Marmitex', 'Coxinha', 'Água', 'Brownie', 'Picanha'][itemIdx]}',
          ${j + 1}, ${(15 + j * 10).toFixed(2)}, 'BRL', ${((j + 1) * (15 + j * 10)).toFixed(2)}
        )
      `);
    }

    if (i < 3) {
      const orderId = randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT INTO commerce_schema.orders (
          id, tenant_id, branch_id, session_id, conversation_id, contact_id, status,
          fulfillment_type, shipping_mode, subtotal_amount, freight_amount, total_amount,
          payment_status, payment_reference, paid_at, created_at, updated_at
        ) VALUES (
          '${orderId}', '${TENANT_ID}', '${BRANCH_IDS.headquarters}', '${sessionId}',
          '${conversationId}', '${contactId}', '${orderStatuses[i]}',
          'DELIVERY', 'FIXED', ${subtotal}, ${freight}, ${total},
          'PAID', '${SEED_TAG}-ORDER-${i + 1}-${Date.now()}',
          now() - interval '${i} days', now() - interval '${i + 1} days', now() - interval '${i} days'
        )
      `);
    }
  }
  console.log('✅ Commerce: 5 sessões, 3 pedidos criados');
}

// ─── SEED SALES ────────────────────────────────────────────────────────────────
async function seedSales() {
  console.log('💰 Criando dados de vendas...');

  // Sales Metrics (last 7 days)
  for (let i = 0; i < 7; i++) {
    await prisma.salesMetric.create({
      data: {
        tenantId: TENANT_ID,
        date: daysAgo(i),
        totalMessages: 40 + Math.floor(Math.random() * 30),
        purchaseIntents: 10 + Math.floor(Math.random() * 8),
        paymentLinksGenerated: 5 + Math.floor(Math.random() * 5),
        estimatedRevenue: 800 + Math.floor(Math.random() * 500),
      },
    });
  }

  // Payment Links
  const linkStatuses = ['ACTIVE', 'ACTIVE', 'EXPIRED', 'ACTIVE'];
  for (let i = 0; i < 4; i++) {
    await prisma.paymentLink.create({
      data: {
        tenantId: TENANT_ID,
        contactId: CONTACT_IDS[i],
        conversationId: CONVERSATION_IDS[i % CONVERSATION_IDS.length],
        externalId: `${SEED_TAG}-PL-${i + 1}-${Date.now()}-${randomUUID().slice(0, 8)}`,
        name: `Pagamento pedido #${i + 1}`,
        description: `Link de pagamento para ${NAMES[i]}`,
        value: 50 + i * 25,
        url: `https://pay.example.com/${SEED_TAG}-${i}`,
        billingType: 'UNDEFINED',
        status: linkStatuses[i],
        source: 'MANUAL',
        resourceType: 'ORDER',
        expiresAt: linkStatuses[i] === 'EXPIRED' ? daysAgo(1) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Sales Promotions
  const promoId1 = randomUUID();
  await prisma.salesPromotion.create({
    data: {
      id: promoId1,
      tenantId: TENANT_ID,
      title: 'Promoção de Inverno',
      description: '20% de desconto em combos executivos',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      active: true,
      startsAt: daysAgo(7),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.salesPromotion.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Frete Grátis Acima de R$50',
      description: 'Frete grátis para pedidos acima de R$50',
      discountType: 'FIXED',
      discountValue: 8,
      minimumOrder: 50,
      active: true,
      startsAt: daysAgo(14),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  // Sales Coupons
  await prisma.salesCoupon.create({
    data: {
      tenantId: TENANT_ID,
      promotionId: promoId1,
      code: 'BEMVINDO10',
      description: '10% de desconto na primeira compra',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 100,
      usedCount: 23,
      startsAt: daysAgo(30),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      active: true,
    },
  });
  await prisma.salesCoupon.create({
    data: {
      tenantId: TENANT_ID,
      code: 'FIDELIDADE15',
      description: 'Cupom para clientes fiéis',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxUses: 50,
      usedCount: 50,
      startsAt: daysAgo(60),
      expiresAt: daysAgo(5),
      active: false,
    },
  });

  // Proposals
  const proposalStatuses = ['DRAFT', 'SENT', 'ACCEPTED'];
  for (let i = 0; i < 3; i++) {
    await prisma.proposal.create({
      data: {
        tenantId: TENANT_ID,
        contactId: CONTACT_IDS[i + 5],
        userId: USER_IDS.manager,
        title: ['Proposta Evento Corporativo', 'Buffet Aniversário', 'Catering Semanal'][i],
        description: `Proposta comercial para ${NAMES[i + 5]}`,
        status: proposalStatuses[i],
        totalAmount: [3500, 2800, 1200][i],
        validUntil: new Date(Date.now() + (15 + i * 10) * 24 * 60 * 60 * 1000),
        items: [{ name: 'Buffet completo', quantity: 1, unitPrice: [3500, 2800, 1200][i] }],
      },
    });
  }

  // Conversation Sale Events
  for (let i = 0; i < 2; i++) {
    await prisma.conversationSaleEvent.create({
      data: {
        tenantId: TENANT_ID,
        conversationId: CONVERSATION_IDS[i],
        attributedUserId: USER_IDS.agent,
        saleAmount: [89.90, 35.90][i],
        lifecycleStatus: 'CONFIRMED',
        aiValidationStatus: 'VALIDATED',
        markedByUserId: USER_IDS.agent,
        markedAt: hoursAgo(12 + i * 6),
        metadata: { source: 'whatsapp', items: ['combo executivo'] },
      },
    });
  }

  console.log('✅ Vendas: métricas, links, promoções, cupons, propostas criados');
}

// ─── SEED BILLING ──────────────────────────────────────────────────────────────
async function seedBilling() {
  console.log('💳 Criando dados de billing...');

  const subscriptionId = randomUUID();
  await prisma.subscription.create({
    data: {
      id: subscriptionId,
      tenantId: TENANT_ID,
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      messagesQuota: 5000,
      aiTokensQuota: 100000,
      contactsQuota: 500,
      billingCycleStart: daysAgo(15),
      billingCycleEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      baseMonthlyPrice: 149.90,
      addonsMonthlyPrice: 50.00,
      totalMonthlyPrice: 199.90,
      pricingSnapshot: { plan: 'PROFESSIONAL', basePrice: 149.90 },
      config: { autoRenew: true },
    },
  });

  // Subscription Modules
  const modules = ['messaging', 'commerce', 'scheduling'];
  for (const mod of modules) {
    await prisma.subscriptionModule.create({
      data: {
        subscriptionId,
        tenantId: TENANT_ID,
        moduleCode: mod,
        status: 'ACTIVE',
        monthlyPrice: mod === 'messaging' ? 0 : 25.00,
        pricingSnapshot: { module: mod },
        quotaImpact: {},
        metadata: {},
        startedAt: daysAgo(30),
      },
    });
  }

  // Usage Record
  await prisma.usageRecord.create({
    data: {
      tenantId: TENANT_ID,
      periodStart: daysAgo(15),
      periodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      messagesUsed: 342,
      aiTokensUsed: 15800,
      contactsUsed: 15,
    },
  });

  console.log('✅ Billing: assinatura, módulos e uso criados');
}

// ─── SEED RECOVERY ─────────────────────────────────────────────────────────────
async function seedRecovery() {
  console.log('🔄 Criando casos de recuperação...');

  const statuses = ['READY_TO_CONTACT', 'CONTACTED', 'NEGOTIATING', 'PAID', 'OVERDUE', 'READY_TO_CONTACT'];
  const sources = ['BILLING', 'MANUAL', 'BILLING', 'BILLING', 'MANUAL', 'BILLING'];
  const amounts = [199.90, 89.90, 350.00, 150.00, 420.00, 75.00];

  for (let i = 0; i < 6; i++) {
    await prisma.recoveryCase.create({
      data: {
        tenantId: TENANT_ID,
        contactId: CONTACT_IDS[i + 3],
        debtorName: NAMES[i + 3],
        phone: PHONES[i + 3],
        status: statuses[i],
        source: sources[i],
        amountDue: amounts[i],
        dueDate: daysAgo(10 - i * 3),
        chargeTitle: `Cobrança pedido ${NAMES[i + 3]}`,
        chargeDescription: `Cobrança referente a pedido/serviço de ${NAMES[i + 3]}`,
        lastContactedAt: i < 3 ? hoursAgo(24 * (i + 1)) : undefined,
        paidAt: statuses[i] === 'PAID' ? hoursAgo(12) : undefined,
      },
    });
  }

  console.log('✅ 6 casos de recuperação criados');
}

// ─── SEED PROSPECTING ──────────────────────────────────────────────────────────
async function seedProspecting() {
  console.log('🎯 Criando dados de prospecção...');

  const campaignIds = [randomUUID(), randomUUID()];
  const campaigns = [
    { id: campaignIds[0], name: 'Campanha Restaurantes Região', status: 'ACTIVE', objective: 'ACQUISITION', audienceType: 'NEW_LEADS', channel: 'WHATSAPP', dailyLimit: 20 },
    { id: campaignIds[1], name: 'Reativação Clientes Inativos', status: 'COMPLETED', objective: 'REACTIVATION', audienceType: 'INACTIVE', channel: 'WHATSAPP', dailyLimit: 15 },
  ];

  for (const camp of campaigns) {
    await prisma.prospectCampaign.create({
      data: {
        id: camp.id,
        tenantId: TENANT_ID,
        name: camp.name,
        status: camp.status,
        objective: camp.objective,
        audienceType: camp.audienceType,
        channel: camp.channel,
        dailyLimit: camp.dailyLimit,
        messageTemplate: 'Olá! Somos o Sabor & Cia. Temos uma oferta especial para você.',
      },
    });
  }

  // Executions
  const execStatuses = ['SENT', 'DELIVERED', 'REPLIED', 'SENT', 'FAILED'];
  for (let i = 0; i < 5; i++) {
    await prisma.prospectExecution.create({
      data: {
        tenantId: TENANT_ID,
        campaignId: campaignIds[i < 3 ? 0 : 1],
        contactId: CONTACT_IDS[i + 10],
        channel: 'WHATSAPP',
        status: execStatuses[i],
        attemptCount: i < 3 ? 1 : 2,
      },
    });
  }

  // Prospect Search
  const searchId = randomUUID();
  await prisma.prospectSearch.create({
    data: {
      id: searchId,
      tenantId: TENANT_ID,
      businessTypeQuery: 'restaurantes delivery',
      city: 'São Paulo',
      state: 'SP',
      neighborhood: 'Vila Mariana',
      source: 'GOOGLE_MAPS',
      maxResults: 10,
      status: 'COMPLETED',
      discoveredCount: 3,
    },
  });

  // Search Results
  const searchResults = [
    { name: 'Cantina do Bairro', phone: '5511944332211', city: 'São Paulo' },
    { name: 'Sabores da Vila', phone: '5511933221100', city: 'São Paulo' },
    { name: 'Grill Express', phone: '5511922110099', city: 'São Paulo' },
  ];

  for (const result of searchResults) {
    await prisma.prospectSearchResult.create({
      data: {
        tenantId: TENANT_ID,
        searchId,
        businessName: result.name,
        phone: result.phone,
        city: result.city,
        source: 'GOOGLE_MAPS',
      },
    });
  }

  // Lead Capture
  await prisma.prospectLeadCapture.create({
    data: {
      tenantId: TENANT_ID,
      source: 'GOOGLE_ADS',
      externalLeadId: `${SEED_TAG}-LEAD-${Date.now()}`,
      campaignName: 'Delivery SP',
      formName: 'Formulário Site - Delivery',
      fullName: 'Ricardo Mendes',
      phone: '5511955443322',
      email: 'ricardo@email.com',
      city: 'São Paulo',
      state: 'SP',
      submissionAt: hoursAgo(6),
      importStatus: 'IMPORTED',
    },
  });

  console.log('✅ Prospecção: 2 campanhas, 5 execuções, 1 busca, 1 captura criados');
}

// ─── SEED SOCIAL ───────────────────────────────────────────────────────────────
async function seedSocial() {
  console.log('📱 Criando dados de social...');

  await prisma.socialAccount.create({
    data: {
      id: SOCIAL_ACCOUNT_ID,
      tenantId: TENANT_ID,
      platform: 'INSTAGRAM',
      externalAccountId: 'seed-ig-12345',
      username: 'saborecia_oficial',
      displayName: 'Sabor & Cia Restaurante',
      status: 'ACTIVE',
      accessToken: 'seed-fake-token',
      connectedAt: daysAgo(30),
    },
  });

  // Social Posts
  const posts = [
    { caption: 'Nosso combo executivo de hoje! Frango grelhado com arroz e salada. Peça já!', type: 'IMAGE', comments: 8 },
    { caption: 'Sexta-feira é dia de feijoada completa! Faça sua reserva', type: 'IMAGE', comments: 15 },
    { caption: 'Novidade no cardápio: Brownie com sorvete artesanal', type: 'CAROUSEL', comments: 22 },
  ];

  for (let i = 0; i < 3; i++) {
    await prisma.socialPost.create({
      data: {
        id: SOCIAL_POST_IDS[i],
        tenantId: TENANT_ID,
        socialAccountId: SOCIAL_ACCOUNT_ID,
        platform: 'INSTAGRAM',
        externalPostId: `seed-post-${i + 1}-${Date.now()}`,
        postType: posts[i].type,
        caption: posts[i].caption,
        mediaUrl: `https://example.com/posts/img-${i + 1}.jpg`,
        commentCount: posts[i].comments,
        postedAt: daysAgo(3 - i),
        discoveredAt: daysAgo(3 - i),
      },
    });
  }

  // Social Comments
  const commentSentiments = ['POSITIVE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'POSITIVE'];
  const commentTexts = [
    'Que delícia! Vou pedir hoje mesmo',
    'Melhor restaurante da região!',
    'Qual o horário de funcionamento?',
    'Última vez demorou muito a entrega',
    'Amei o brownie! Quero mais!',
  ];
  const commentIds: string[] = [];

  for (let i = 0; i < 5; i++) {
    const commentId = randomUUID();
    commentIds.push(commentId);
    await prisma.socialComment.create({
      data: {
        id: commentId,
        tenantId: TENANT_ID,
        socialAccountId: SOCIAL_ACCOUNT_ID,
        postId: SOCIAL_POST_IDS[i % 3],
        platform: 'INSTAGRAM',
        externalCommentId: `seed-comment-${i + 1}-${Date.now()}`,
        authorUsername: NAMES[i].split(' ')[0].toLowerCase(),
        authorName: NAMES[i],
        text: commentTexts[i],
        sentiment: commentSentiments[i],
        status: i < 3 ? 'REPLIED' : 'PENDING',
        isHidden: false,
        receivedAt: hoursAgo(24 - i * 4),
        repliedAt: i < 3 ? hoursAgo(20 - i * 4) : undefined,
      },
    });
  }

  // Comment Replies
  await prisma.socialCommentReply.create({
    data: {
      tenantId: TENANT_ID,
      commentId: commentIds[0],
      text: 'Obrigado! Esperamos seu pedido!',
      repliedBy: 'AI',
      status: 'SENT',
    },
  });
  await prisma.socialCommentReply.create({
    data: {
      tenantId: TENANT_ID,
      commentId: commentIds[3],
      text: 'Pedimos desculpas pelo ocorrido. Pode nos chamar no WhatsApp?',
      repliedBy: 'HUMAN',
      userId: USER_IDS.agent,
      status: 'SENT',
    },
  });

  // Auto Reply Rule
  await prisma.socialAutoReplyRule.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Resposta automática elogios',
      isActive: true,
      priority: 1,
      platform: 'INSTAGRAM',
      conditions: { keywords: ['delícia', 'melhor', 'amei', 'incrível'], sentiment: 'POSITIVE' },
      actions: { replyTemplate: 'Obrigado pelo carinho! Ficamos felizes que gostou!' },
      limits: { maxPerDay: 50 },
      totalFired: 12,
    },
  });

  // Inbox Thread
  await prisma.socialInboxThread.create({
    data: {
      tenantId: TENANT_ID,
      socialAccountId: SOCIAL_ACCOUNT_ID,
      platform: 'INSTAGRAM',
      recipientExternalId: 'seed-user-ext-123',
      recipientUsername: NAMES[2].split(' ')[0].toLowerCase(),
      lastMessageText: 'Vocês fazem entrega na Vila Madalena?',
      lastMessageAt: hoursAgo(3),
      messageCount: 4,
      status: 'OPEN',
    },
  });

  console.log('✅ Social: conta, posts, comentários, respostas, regra e thread criados');
}

// ─── SEED SCHEDULING ───────────────────────────────────────────────────────────
async function seedScheduling() {
  console.log('📅 Criando dados de agendamento...');

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const redis = new Redis(redisUrl);

  try {
    const professionalIds = [randomUUID(), randomUUID()];
    const professionals = [
      { id: professionalIds[0], tenantId: TENANT_ID, branchId: BRANCH_IDS.headquarters, name: 'Carlos Barbeiro', phone: '5511988001001', role: 'Barbeiro', active: true, createdAt: new Date().toISOString() },
      { id: professionalIds[1], tenantId: TENANT_ID, branchId: BRANCH_IDS.headquarters, name: 'Marcos Cabeleireiro', phone: '5511988001002', role: 'Cabeleireiro', active: true, createdAt: new Date().toISOString() },
    ];

    const profKey = `scheduling:tenant:${TENANT_ID}:professionals`;
    await redis.del(profKey);
    for (const prof of professionals) {
      await redis.hset(profKey, prof.id, JSON.stringify(prof));
    }

    const categoryIds = [randomUUID(), randomUUID()];
    const categories = [
      { id: categoryIds[0], tenantId: TENANT_ID, branchId: BRANCH_IDS.headquarters, name: 'Corte', unit: 'PER_SESSION', durationMinutes: 30, basePrice: 45.00, active: true, createdAt: new Date().toISOString() },
      { id: categoryIds[1], tenantId: TENANT_ID, branchId: BRANCH_IDS.headquarters, name: 'Barba', unit: 'PER_SESSION', durationMinutes: 20, basePrice: 30.00, active: true, createdAt: new Date().toISOString() },
    ];

    const catKey = `scheduling:tenant:${TENANT_ID}:categories`;
    await redis.del(catKey);
    for (const cat of categories) {
      await redis.hset(catKey, cat.id, JSON.stringify(cat));
    }

    for (const profId of professionalIds) {
      const profCatKey = `scheduling:tenant:${TENANT_ID}:professional:${profId}:categories`;
      await redis.del(profCatKey);
      await redis.sadd(profCatKey, ...categoryIds);
    }
    for (const catId of categoryIds) {
      const catProfKey = `scheduling:tenant:${TENANT_ID}:category:${catId}:professionals`;
      await redis.del(catProfKey);
      await redis.sadd(catProfKey, ...professionalIds);
    }

    // Availability Slots
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const slots = [
      { profIdx: 0, date: today, startsAt: '09:00', endsAt: '09:30', status: 'AVAILABLE', catIdx: 0 },
      { profIdx: 0, date: today, startsAt: '10:00', endsAt: '10:30', status: 'RESERVED', catIdx: 0 },
      { profIdx: 0, date: today, startsAt: '14:00', endsAt: '14:20', status: 'CONFIRMED', catIdx: 1 },
      { profIdx: 1, date: tomorrow, startsAt: '09:00', endsAt: '09:30', status: 'AVAILABLE', catIdx: 0 },
      { profIdx: 1, date: tomorrow, startsAt: '11:00', endsAt: '11:20', status: 'RESERVED', catIdx: 1 },
    ];

    for (const slot of slots) {
      const profId = professionalIds[slot.profIdx];
      const slotId = `${slot.date}__${slot.startsAt}__${slot.endsAt}`;
      const availKey = `scheduling:tenant:${TENANT_ID}:professional:${profId}:availability:${slot.date}`;

      const slotData = {
        id: slotId,
        professionalId: profId,
        categoryId: categoryIds[slot.catIdx],
        date: slot.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: slot.status,
        contactName: slot.status !== 'AVAILABLE' ? NAMES[slot.profIdx + 5] : null,
        contactPhone: slot.status !== 'AVAILABLE' ? PHONES[slot.profIdx + 5] : null,
        payment: slot.status === 'CONFIRMED' ? { status: 'PAID', reference: `${SEED_TAG}-PAY-${slot.profIdx}`, confirmedAt: new Date().toISOString() } : null,
        createdAt: new Date().toISOString(),
      };

      await redis.hset(availKey, slotId, JSON.stringify(slotData));
      const endOfDay = new Date(`${slot.date}T23:59:59.999Z`);
      const ttl = Math.max(Math.floor((endOfDay.getTime() - Date.now()) / 1000) + 172800, 3600);
      await redis.expire(availKey, ttl);
    }

    // Recurring Reservation (PostgreSQL)
    const reservationId = randomUUID();
    await prisma.schedulingRecurringReservation.create({
      data: {
        id: reservationId,
        tenantId: TENANT_ID,
        branchId: BRANCH_IDS.headquarters,
        professionalId: professionalIds[0],
        categoryId: categoryIds[0],
        contactId: CONTACT_IDS[0],
        period: 'WEEKLY',
        interval: 1,
        maxOccurrences: 12,
        occurrencesCreated: 2,
        startsAt: '10:00',
        endsAt: '10:30',
        firstDate: daysAgo(14),
        nextDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        nextRunAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        isFree: false,
        isOnline: false,
        status: 'ACTIVE',
      },
    });

    // Recurring Reservation Runs
    for (let i = 0; i < 2; i++) {
      await prisma.schedulingRecurringReservationRun.create({
        data: {
          recurrenceId: reservationId,
          tenantId: TENANT_ID,
          occurrenceNumber: i + 1,
          targetDate: daysAgo(7 * (2 - i)),
          slotId: `${daysAgo(7 * (2 - i)).toISOString().split('T')[0]}__10:00__10:30`,
          status: 'COMPLETED',
          completedAt: daysAgo(7 * (2 - i)),
        },
      });
    }

    console.log('✅ Scheduling: 2 profissionais, 2 categorias, 5 slots, 1 recorrência criados');
  } finally {
    await redis.quit();
  }
}

// ─── SEED SUPPORT ──────────────────────────────────────────────────────────────
async function seedSupport() {
  console.log('🎫 Criando dados de suporte...');

  const feedbackIds: string[] = [];
  const subjects = ['Problema com pagamento PIX', 'Dúvida sobre integração WhatsApp', 'Sugestão de melhoria no cardápio'];
  const messages = [
    'O pagamento via PIX não está sendo confirmado automaticamente.',
    'Como faço para conectar um segundo número de WhatsApp?',
    'Seria ótimo poder adicionar fotos aos itens do cardápio direto pelo app.',
  ];
  const types = ['BUG', 'QUESTION', 'SUGGESTION'];
  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

  for (let i = 0; i < 3; i++) {
    const feedbackId = randomUUID();
    feedbackIds.push(feedbackId);
    await prisma.supportFeedback.create({
      data: {
        id: feedbackId,
        tenantId: TENANT_ID,
        userId: USER_IDS.admin,
        type: types[i],
        subject: subjects[i],
        message: messages[i],
        status: statuses[i],
      },
    });
  }

  await prisma.supportFeedbackReply.create({
    data: {
      feedbackId: feedbackIds[0],
      authorName: 'Suporte AtendeAi',
      message: 'Estamos verificando o problema com o gateway de pagamento. Retornamos em breve.',
    },
  });
  await prisma.supportFeedbackReply.create({
    data: {
      feedbackId: feedbackIds[1],
      authorName: 'Suporte AtendeAi',
      message: 'Para conectar um segundo número, acesse Configurações > WhatsApp > Adicionar número.',
    },
  });

  console.log('✅ Suporte: 3 feedbacks e 2 respostas criados');
}

// ─── SEED AGENT RULES ──────────────────────────────────────────────────────────
async function seedAgentRules() {
  console.log('🤖 Criando regras de agente...');

  await prisma.tenantAgentRule.create({
    data: {
      tenantId: TENANT_ID,
      moduleId: 'messaging',
      customPrompt: `Ao atender clientes no WhatsApp:\n- Sempre cumprimente pelo nome quando disponível\n- Ofereça o cardápio do dia se o cliente perguntar sobre comida\n- Para pedidos, confirme itens, endereço e forma de pagamento\n- Tempo máximo de resposta: 2 minutos\n- Escale para humano se o cliente reclamar mais de 2 vezes`,
      isActive: true,
      fallbackToGlobal: true,
      revision: 1,
      notes: 'Regra principal de atendimento via WhatsApp',
    },
  });

  await prisma.tenantAgentRule.create({
    data: {
      tenantId: TENANT_ID,
      moduleId: 'sales',
      customPrompt: `Para vendas e conversões:\n- Sempre sugira combos e promoções ativas\n- Ofereça cupom BEMVINDO10 para novos clientes\n- Para pedidos acima de R$50, informe sobre frete grátis\n- Faça upsell de sobremesas após pedido principal`,
      isActive: true,
      fallbackToGlobal: true,
      revision: 1,
      notes: 'Regra de vendas e conversão',
    },
  });

  console.log('✅ 2 regras de agente criadas');
}

// ─── SEED SALES COMMISSION ─────────────────────────────────────────────────────
async function seedSalesCommission() {
  console.log('💼 Criando dados de comissão...');

  await prisma.tenantSalesCommissionDefaults.create({
    data: {
      tenantId: TENANT_ID,
      basePercent: 5.0,
      baseFixedAmount: 0,
      commissionCombineMode: 'STACKED',
    },
  });

  await prisma.tenantUserSalesProfile.create({
    data: {
      tenantId: TENANT_ID,
      userId: USER_IDS.agent,
      commissionPercentOverride: 7.5,
      monthlySalesCountTarget: 50,
      monthlySalesAmountTarget: 5000,
    },
  });

  console.log('✅ Comissão: defaults e perfil de vendas criados');
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SEED ALL MODULES — AtendeAi');
  console.log(`  Tenant: ${TENANT_ID}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
    if (!tenant) {
      console.error(`❌ Tenant ${TENANT_ID} não encontrado. Crie o tenant primeiro.`);
      process.exit(1);
    }

    await cleanup();
    console.log('');

    await seedTenant();
    await seedUsers();
    await seedContacts();
    await seedMessaging();
    await seedAI();
    await seedCatalog();
    await seedInventory();
    await seedCommerce();
    await seedSales();
    await seedBilling();
    await seedRecovery();
    await seedProspecting();
    await seedSocial();
    await seedScheduling();
    await seedSupport();
    await seedAgentRules();
    await seedSalesCommission();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETO — Todos os módulos populados!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📋 Credenciais de teste:');
    const slug = TENANT_ID.slice(0, 8);
    console.log(`   Admin:   seed-admin-${slug}@saborecia.com.br / Test@123`);
    console.log(`   Manager: seed-manager-${slug}@saborecia.com.br / Test@123`);
    console.log(`   Agent:   seed-agent-${slug}@saborecia.com.br / Test@123`);
  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
