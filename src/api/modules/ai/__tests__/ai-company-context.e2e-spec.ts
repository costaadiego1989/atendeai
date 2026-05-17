/**
 * AI Company Context — E2E com IA Real
 *
 * Valida que dados cadastrados na empresa chegam como contexto ao motor de IA
 * e que o pipeline processa a resposta com sucesso.
 *
 * Motor de IA: DeepSeek real (sem mock).
 * Spy passthrough em `generateResponse` captura o systemPrompt enviado.
 * Quota e event bus são substituídos para isolar billing e filas.
 *
 * Pré-requisito: DEEPSEEK_API_KEY definida no ambiente.
 * Suite ignorada automaticamente se a variável estiver ausente.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import {
  AI_ENGINE,
  IAIEngine,
  AIRequest,
  AIResponse,
} from '@modules/ai/application/ports/IAIEngine';
import { IProcessAIResponseUseCase } from '@modules/ai/application/use-cases/interfaces/IProcessAIResponseUseCase';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '@modules/ai/application/ports/IChatHistoryRepository';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeValidCnpj(seedValue: number): string {
  const base = String(seedValue).padStart(12, '0').slice(-12);
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

const subscribers = new Map<
  string,
  Array<{
    consumerName?: string;
    handle: (e: Record<string, unknown>) => Promise<void>;
  }>
>();

const inMemoryEventBus: IEventBus = {
  async publish<T extends IntegrationEvent>(event: T): Promise<void> {
    const handlers = subscribers.get(event.queue) || [];
    const payload = event.toJSON ? event.toJSON() : event;
    for (const h of handlers) {
      if (h.consumerName === 'tenant-twilio-provisioning') continue;
      await h.handle(payload as Record<string, unknown>);
    }
  },
  subscribe<T extends IntegrationEvent>(
    queue: string,
    handler: (event: T) => Promise<void>,
    options?: { consumerName?: string },
  ): void {
    const handlers = subscribers.get(queue) || [];
    handlers.push({
      consumerName: options?.consumerName,
      handle: handler as unknown as (
        e: Record<string, unknown>,
      ) => Promise<void>,
    });
    subscribers.set(queue, handlers);
  },
};

const mockQuotaUseCase = {
  execute: jest.fn(async () => ({
    canProceed: true,
    used: 0,
    quota: 100_000,
    status: 'ACTIVE',
  })),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AI Company Context (e2e — IA real)', () => {
  const hasApiKey = Boolean(process.env.DEEPSEEK_API_KEY);

  if (!hasApiKey) {
    it.skip('DEEPSEEK_API_KEY ausente — suite ignorada', () => {});
    return;
  }

  jest.setTimeout(120_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processAI: IProcessAIResponseUseCase;
  let chatHistory: IChatHistoryRepository;
  let aiEngine: IAIEngine;
  let generateSpy: jest.SpyInstance<Promise<AIResponse>, [AIRequest]>;

  let tenantId: string;
  let tenantBId: string;

  const seed = Date.now();
  const ownerEmail = `ai-ctx-e2e-${seed}@test.com`;
  const ownerEmailB = `ai-ctx-e2e-b-${seed}@test.com`;
  const password = 'SenhaForte123!';

  // ─── Fixtures ──────────────────────────────────────────────────────────────

  async function seedBusinessData(
    tid: string,
    data: {
      businessType?: string;
      description?: string;
      services?: string;
      catalogUrl?: string;
      catalogFiles?: string[];
      operatingHours?: Record<string, unknown>;
    },
  ) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tenant_schema.tenants
      SET
        business_type     = ${data.businessType ?? null},
        description       = ${data.description ?? null},
        services          = ${data.services ?? null},
        catalog_url       = ${data.catalogUrl ?? null},
        catalog_files     = ${JSON.stringify(data.catalogFiles ?? [])}::jsonb,
        operating_hours   = ${data.operatingHours ? JSON.stringify(data.operatingHours) : null}::jsonb,
        updated_at        = NOW()
      WHERE id = ${tid}::uuid
    `);
  }

  async function seedAddress(
    tid: string,
    addr: {
      zipcode: string;
      street: string;
      streetNumber: string;
      neighborhood: string;
      city: string;
      state: string;
    },
  ) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tenant_schema.tenants
      SET
        zipcode        = ${addr.zipcode},
        street         = ${addr.street},
        street_number  = ${addr.streetNumber},
        neighborhood   = ${addr.neighborhood},
        city           = ${addr.city},
        state          = ${addr.state},
        updated_at     = NOW()
      WHERE id = ${tid}::uuid
    `);
  }

  async function seedPDFResume(
    tid: string,
    fileName: string,
    summaries: string[],
  ) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO tenant_schema.tenant_pdf_resumes
        (tenant_id, file_name, file_url, checksum, summaries, status, error)
      VALUES
        (${tid}::uuid, ${fileName}, null, null, ${JSON.stringify(summaries)}::jsonb, 'READY', null)
    `);
  }

  async function createConversation(tid: string, contactPhone: string) {
    const contact = await prisma.contact.create({
      data: {
        tenantId: tid,
        name: 'Contato E2E',
        phone: contactPhone,
        stage: 'LEAD',
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tid,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });
    await prisma.message.create({
      data: {
        id: randomUUID(),
        conversationId: conversation.id,
        direction: 'INBOUND',
        sentBy: 'CONTACT',
        content: { type: 'TEXT', text: 'Oi' },
        externalId: `msg-${randomUUID()}`,
      },
    });
    return { contact, conversation };
  }

  function capturedSystemPrompt(): string {
    const calls = generateSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0].systemPrompt;
  }

  async function getAssistantReply(conversationId: string): Promise<string> {
    const history = await chatHistory.getHistory(conversationId);
    const msg = history.filter((m) => m.role === 'assistant').at(-1);
    return msg?.content ?? '';
  }

  // ─── Setup / Teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ICheckQuotaUseCase)
      .useValue(mockQuotaUseCase)
      .overrideProvider(EVENT_BUS)
      .useValue(inMemoryEventBus)
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    processAI = app.get(IProcessAIResponseUseCase);
    chatHistory = app.get(CHAT_HISTORY_REPOSITORY);
    aiEngine = app.get<IAIEngine>(AI_ENGINE);

    // Spy passthrough — chama DeepSeek real, captura argumentos
    generateSpy = jest.spyOn(aiEngine, 'generateResponse');

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);

    const a = await createTenant.execute({
      companyName: 'Empresa Contexto AI E2E',
      cnpj: makeValidCnpj(seed),
      ownerName: 'Dono A',
      ownerEmail,
      ownerPhone: `1197${String(seed).slice(-7)}`,
      ownerPassword: password,
      plan: 'PROFISSIONAL',
      businessType: 'SERVICOS',
    });
    tenantId = a.id;

    const b = await createTenant.execute({
      companyName: 'Empresa B Isolamento',
      cnpj: makeValidCnpj(seed + 1),
      ownerName: 'Dono B',
      ownerEmail: ownerEmailB,
      ownerPhone: `1197${String(seed + 1).slice(-7)}`,
      ownerPassword: password,
      plan: 'PROFISSIONAL',
      businessType: 'SERVICOS',
    });
    tenantBId = b.id;
  });

  beforeEach(() => {
    generateSpy.mockClear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const ids = [tenantId, tenantBId].filter(Boolean);
    for (const id of ids) {
      await prisma
        .$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_pdf_resumes WHERE tenant_id = ${id}::uuid`,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_audit_logs WHERE tenant_id = ${id}::uuid`,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_agent_rules WHERE tenant_id = ${id}::uuid`,
        )
        .catch(() => {});
    }
    await prisma.message
      .deleteMany({ where: { conversation: { tenantId: { in: ids } } } })
      .catch(() => {});
    await prisma.conversation
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.contact
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.aISession
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.usageRecord
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.subscription
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.aIConfig
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => {});
    await app.close();
  });

  // ─── Testes ────────────────────────────────────────────────────────────────

  describe('1 — pipeline básico com IA real', () => {
    it('pipeline retorna success=true e salva resposta da IA no histórico', async () => {
      const { contact, conversation } = await createConversation(
        tenantId,
        `5511960${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: {
          type: 'TEXT',
          text: 'Olá, gostaria de saber mais sobre vocês.',
        },
      });

      expect(result).toEqual({ success: true });

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);

      // Spy confirma que IA real foi chamada (não mock)
      expect(generateSpy).toHaveBeenCalledTimes(1);
      const req = generateSpy.mock.calls[0][0];
      expect(req.systemPrompt).toContain('Company Name:');
      expect(req.userMessage).toBe('Olá, gostaria de saber mais sobre vocês.');
    });
  });

  describe('2 — horário de funcionamento', () => {
    it('systemPrompt contém Operating Hours quando configurado — IA recebe contexto de horário', async () => {
      await seedBusinessData(tenantId, {
        operatingHours: {
          monday: { open: '08:00', close: '18:00', closed: false },
          tuesday: { open: '08:00', close: '18:00', closed: false },
          wednesday: { open: '08:00', close: '18:00', closed: false },
          thursday: { open: '08:00', close: '18:00', closed: false },
          friday: { open: '08:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '13:00', closed: false },
          sunday: { open: '', close: '', closed: true },
        },
      });

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511961${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: {
          type: 'TEXT',
          text: 'Qual é o horário de atendimento de vocês?',
        },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('Operating Hours:');
      expect(prompt).toContain('"08:00"');
      expect(prompt).toContain('"18:00"');
      expect(prompt).toContain('"saturday"');
      expect(prompt).toContain('"sunday"');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);
    });

    it('systemPrompt NÃO contém Operating Hours quando não configurado', async () => {
      await seedBusinessData(tenantId, { operatingHours: undefined });

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511962${String(seed).slice(-6)}`,
      );

      await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Qual é o horário de vocês?' },
      });

      const prompt = capturedSystemPrompt();
      expect(prompt).not.toContain('Operating Hours:');
    });
  });

  describe('3 — endereço / localização', () => {
    it('systemPrompt contém Location com endereço completo — IA recebe contexto de localização', async () => {
      await seedAddress(tenantId, {
        zipcode: '01310-100',
        street: 'Avenida Paulista',
        streetNumber: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      });

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511963${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Onde vocês ficam localizados?' },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('Location:');
      expect(prompt).toContain('Avenida Paulista');
      expect(prompt).toContain('São Paulo');
      expect(prompt).toContain('SP');
      expect(prompt).toContain('01310-100');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);
    });
  });

  describe('4 — descrição e serviços', () => {
    it('systemPrompt contém Description e Services quando configurados', async () => {
      await seedBusinessData(tenantId, {
        description:
          'Clínica odontológica especializada em implantes, limpeza e estética dental.',
        services:
          'Implante osseointegrado, clareamento dental, ortodontia, limpeza profissional',
        businessType: 'Clínica Odontológica',
      });

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511964${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Quais tratamentos vocês realizam?' },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('Description:');
      expect(prompt).toContain('implantes');
      expect(prompt).toContain('Services/Products:');
      expect(prompt).toContain('ortodontia');
      expect(prompt).toContain('Business Type: Clínica Odontológica');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);
    });
  });

  describe('5 — catalogUrl e catalogFiles', () => {
    it('systemPrompt contém Catalog e Knowledge Base quando URLs configuradas', async () => {
      await seedBusinessData(tenantId, {
        catalogUrl: 'https://clinica.test/tabela-precos.pdf',
        catalogFiles: [
          'https://storage.test/protocolos-2025.pdf',
          'https://storage.test/convenios.pdf',
        ],
      });

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511965${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: {
          type: 'TEXT',
          text: 'Vocês têm tabela de preços disponível?',
        },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('Catalog:');
      expect(prompt).toContain('https://clinica.test/tabela-precos.pdf');
      expect(prompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(prompt).toContain('https://storage.test/protocolos-2025.pdf');
      expect(prompt).toContain('https://storage.test/convenios.pdf');
    });
  });

  describe('6 — PDF context via banco (TenantPDFContextProvider)', () => {
    it('systemPrompt injeta [CONTEXTO DE DOCUMENTOS] com summaries READY do banco', async () => {
      await seedPDFResume(tenantId, 'cardapio-restaurante.pdf', [
        'Pizza Margherita R$42 · Pizza Calabresa R$45 · Pizza Quatro Queijos R$48',
        'Hamburguer Artesanal R$38 · Batata Frita R$18 · Refrigerante R$8',
        'Funcionamento: segunda a sábado das 11h30 às 23h00. Delivery disponível.',
      ]);

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511966${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Vocês têm pizza? Quais os preços?' },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(prompt).toContain('Pizza Margherita R$42');
      expect(prompt).toContain('Hamburguer Artesanal R$38');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);
    });

    it('PDF de outro tenant NÃO aparece no contexto do tenantId correto', async () => {
      await seedPDFResume(tenantBId, 'exclusivo-tenant-b.pdf', [
        'DADO_EXCLUSIVO_TENANT_B: informação sigilosa do tenant B',
      ]);

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511967${String(seed).slice(-6)}`,
      );

      await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Tem alguma informação sobre planos?' },
      });

      const prompt = capturedSystemPrompt();
      expect(prompt).not.toContain('DADO_EXCLUSIVO_TENANT_B');
    });
  });

  describe('7 — tenant sem dados de empresa', () => {
    it('prompt não contém seções de dados de empresa quando nada configurado — IA responde sem inventar', async () => {
      // Garante estado limpo — remove PDFs e dados de negócio do tenantBId
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM tenant_schema.tenant_pdf_resumes WHERE tenant_id = ${tenantBId}::uuid`,
      );
      await seedBusinessData(tenantBId, {
        operatingHours: undefined,
        description: undefined,
        services: undefined,
        catalogUrl: undefined,
        catalogFiles: [],
      });

      const { contact, conversation } = await createConversation(
        tenantBId,
        `5511968${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId: tenantBId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Qual é o horário de funcionamento?' },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();
      expect(prompt).not.toContain('Operating Hours:');
      expect(prompt).not.toContain('Description:');
      expect(prompt).not.toContain('Services/Products:');
      expect(prompt).not.toContain('Location:');
      expect(prompt).not.toContain('Knowledge Base');
      expect(prompt).not.toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      // Persona de vendas ainda presente
      expect(prompt).toContain('SENIOR SALES PERSONA INSTRUCTIONS');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(5);
    });
  });

  describe('8 — isolamento de tenant', () => {
    it('dados do tenantA não contaminam o systemPrompt do tenantB', async () => {
      const marcador = `DADO_EXCLUSIVO_TENANT_A_${seed}`;
      await seedBusinessData(tenantId, {
        description: `Empresa especializada. ${marcador}`,
      });

      // Chamada para tenantB — não deve ver dados do tenantA
      const { contact, conversation } = await createConversation(
        tenantBId,
        `5511969${String(seed).slice(-6)}`,
      );

      await processAI.execute({
        tenantId: tenantBId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Me conta sobre a empresa.' },
      });

      const prompt = capturedSystemPrompt();
      expect(prompt).not.toContain(marcador);
    });

    it('tenantId no AIRequest bate com o tenant chamado', async () => {
      const { contact, conversation } = await createConversation(
        tenantId,
        `5511970${String(seed).slice(-6)}`,
      );

      await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: { type: 'TEXT', text: 'Oi' },
      });

      const req = generateSpy.mock.calls[0][0];
      expect(req.trace?.tenantId).toBe(tenantId);
    });
  });

  describe('9 — contexto completo — todos os dados configurados', () => {
    it('IA recebe todos os campos de empresa quando tudo configurado — pipeline completo', async () => {
      await seedBusinessData(tenantId, {
        businessType: 'Restaurante Contemporâneo',
        description:
          'Restaurante especializado em culinária brasileira artesanal e contemporânea.',
        services:
          'Almoço executivo, jantar à la carte, delivery, eventos privados e buffet',
        catalogUrl: 'https://restaurante.test/cardapio-completo',
        catalogFiles: ['https://storage.test/cardapio-2025.pdf'],
        operatingHours: {
          monday: { open: '', close: '', closed: true },
          tuesday: { open: '11:30', close: '15:00', closed: false },
          wednesday: { open: '11:30', close: '23:00', closed: false },
          thursday: { open: '11:30', close: '23:00', closed: false },
          friday: { open: '11:30', close: '23:30', closed: false },
          saturday: { open: '12:00', close: '23:30', closed: false },
          sunday: { open: '12:00', close: '17:00', closed: false },
        },
      });
      await seedAddress(tenantId, {
        zipcode: '01311-300',
        street: 'Rua Augusta',
        streetNumber: '500',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        state: 'SP',
      });
      await seedPDFResume(tenantId, 'cardapio-completo.pdf', [
        'Prato do dia: Frango grelhado com arroz de brócolis R$42',
        'Entrada: Ceviche de tilápia R$32 · Bruschetta de tomate R$24',
        'Sobremesa: Petit gâteau R$28 · Pudim da casa R$18',
      ]);

      const { contact, conversation } = await createConversation(
        tenantId,
        `5511971${String(seed).slice(-6)}`,
      );

      const result = await processAI.execute({
        tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        content: {
          type: 'TEXT',
          text: 'Quero saber o horário, endereço e se tem opção de delivery.',
        },
      });

      expect(result).toEqual({ success: true });

      const prompt = capturedSystemPrompt();

      // Dados estáticos (PromptBuilder)
      expect(prompt).toContain('Business Type: Restaurante Contemporâneo');
      expect(prompt).toContain('culinária brasileira artesanal');
      expect(prompt).toContain('Services/Products:');
      expect(prompt).toContain('delivery');
      expect(prompt).toContain('Catalog:');
      expect(prompt).toContain('Knowledge Base (Catalog PDFs):');
      expect(prompt).toContain('Location:');
      expect(prompt).toContain('Rua Augusta');
      expect(prompt).toContain('Operating Hours:');
      expect(prompt).toContain('"tuesday"');
      expect(prompt).toContain('"11:30"');

      // Contexto dinâmico (PDFs do banco)
      expect(prompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(prompt).toContain('Frango grelhado');
      expect(prompt).toContain('Petit gâteau');

      const reply = await getAssistantReply(conversation.id);
      expect(reply.length).toBeGreaterThan(10);
    });
  });

  // ─── Bloco 10: Validação semântica — IA usa o contexto na resposta ──────────
  //
  // Esses testes vão além de assertar o systemPrompt.
  // Verificam se a IA real produziu uma resposta que reflete o contexto injetado.
  // Assertions são propositalmente flexíveis (regex com variações de frase) para
  // acomodar a não-determinismo natural do modelo sem tornar os testes frágeis.
  // ────────────────────────────────────────────────────────────────────────────

  describe('10 — validação semântica: IA usa o contexto na resposta', () => {
    describe('10.1 — horário de funcionamento', () => {
      it('resposta menciona horários quando usuário pergunta diretamente sobre horário', async () => {
        await seedBusinessData(tenantId, {
          operatingHours: {
            monday: { open: '08:00', close: '18:00', closed: false },
            tuesday: { open: '08:00', close: '18:00', closed: false },
            wednesday: { open: '08:00', close: '18:00', closed: false },
            thursday: { open: '08:00', close: '18:00', closed: false },
            friday: { open: '08:00', close: '17:00', closed: false },
            saturday: { open: '09:00', close: '13:00', closed: false },
            sunday: { open: '', close: '', closed: true },
          },
        });

        const { contact, conversation } = await createConversation(
          tenantId,
          `5511981${String(seed).slice(-6)}`,
        );

        const result = await processAI.execute({
          tenantId,
          conversationId: conversation.id,
          contactId: contact.id,
          content: {
            type: 'TEXT',
            text: 'Qual é o horário de atendimento de vocês?',
          },
        });

        expect(result).toEqual({ success: true });

        const reply = await getAssistantReply(conversation.id);

        // IA deve mencionar algum valor de hora ou dia da semana do contexto configurado.
        // Aceita formatos como "08h", "8h", "08:00", "segunda", "sábado", "13h", "17h".
        expect(reply).toMatch(
          /\b(0?8[h:]|8h|18h|17h|09h|13h|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo|aberto|fechado|atendemos|funcionamos)/i,
        );

        // IA não deve dizer que não tem a informação quando ela está configurada
        expect(reply).not.toMatch(
          /não (tenho|possuo|temos) (essa |essa )?informação (sobre )?hora/i,
        );
      });
    });

    describe('10.2 — endereço / localização', () => {
      it('resposta menciona localização quando usuário pergunta diretamente sobre endereço', async () => {
        await seedAddress(tenantId, {
          zipcode: '01310-100',
          street: 'Avenida Paulista',
          streetNumber: '1000',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        });

        const { contact, conversation } = await createConversation(
          tenantId,
          `5511982${String(seed).slice(-6)}`,
        );

        const result = await processAI.execute({
          tenantId,
          conversationId: conversation.id,
          contactId: contact.id,
          content: {
            type: 'TEXT',
            text: 'Qual é o endereço de vocês? Onde fica a loja?',
          },
        });

        expect(result).toEqual({ success: true });

        const reply = await getAssistantReply(conversation.id);

        // Aceita "Paulista", "São Paulo", "Bela Vista", "SP", "01310" ou variações
        expect(reply).toMatch(
          /paulista|são paulo|bela vista|\bsp\b|01310|avenida/i,
        );

        expect(reply).not.toMatch(/não (tenho|possuo|temos) (o )?endereço/i);
      });
    });

    describe('10.3 — descrição e serviços', () => {
      it('resposta menciona serviços configurados quando usuário pergunta sobre o que a empresa oferece', async () => {
        await seedBusinessData(tenantId, {
          businessType: 'Clínica Odontológica',
          description:
            'Clínica especializada em saúde bucal com foco em estética e reabilitação oral.',
          services:
            'Implante osseointegrado, clareamento dental, ortodontia, limpeza profissional',
        });

        const { contact, conversation } = await createConversation(
          tenantId,
          `5511983${String(seed).slice(-6)}`,
        );

        const result = await processAI.execute({
          tenantId,
          conversationId: conversation.id,
          contactId: contact.id,
          content: {
            type: 'TEXT',
            text: 'Quais tratamentos e serviços vocês realizam?',
          },
        });

        expect(result).toEqual({ success: true });

        const reply = await getAssistantReply(conversation.id);

        // Ao menos um dos serviços configurados deve aparecer na resposta
        expect(reply).toMatch(
          /implante|clareamento|ortodontia|limpeza|odontol|dental|bucal|estética|reabilita/i,
        );

        expect(reply).not.toMatch(
          /não (tenho|possuo|temos) informações sobre (os )?serviços/i,
        );
      });
    });

    describe('10.4 — PDF / cardápio via banco', () => {
      it('resposta referencia conteúdo do PDF quando usuário pergunta sobre cardápio', async () => {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_pdf_resumes WHERE tenant_id = ${tenantId}::uuid`,
        );
        await seedPDFResume(tenantId, 'cardapio.pdf', [
          'Cardápio principal: Pizza Margherita R$42, Pizza Calabresa R$45, Lasanha Bolonhesa R$38',
          'Bebidas: Suco natural R$12, Refrigerante R$8, Água mineral R$5',
          'Sobremesas: Tiramisu R$22, Petit gâteau R$28',
        ]);

        const { contact, conversation } = await createConversation(
          tenantId,
          `5511984${String(seed).slice(-6)}`,
        );

        const result = await processAI.execute({
          tenantId,
          conversationId: conversation.id,
          contactId: contact.id,
          content: {
            type: 'TEXT',
            text: 'Vocês têm pizza? Pode me dizer os preços do cardápio?',
          },
        });

        expect(result).toEqual({ success: true });

        const prompt = capturedSystemPrompt();
        // Confirma que o contexto de documentos chegou ao prompt
        expect(prompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
        expect(prompt).toContain('Pizza Margherita R$42');

        const reply = await getAssistantReply(conversation.id);

        // IA deve mencionar pizza, preço ou cardápio a partir do contexto do PDF
        expect(reply).toMatch(
          /pizza|margherita|calabresa|lasanha|cardápio|cardapio|r\$\s*4[25]|\b42\b|\b45\b/i,
        );
      });
    });

    describe('10.5 — sem dados: IA não inventa contexto', () => {
      it('resposta não afirma horário específico quando nenhum horário está configurado', async () => {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM tenant_schema.tenant_pdf_resumes WHERE tenant_id = ${tenantBId}::uuid`,
        );
        await seedBusinessData(tenantBId, {
          operatingHours: undefined,
          description: undefined,
          services: undefined,
          catalogUrl: undefined,
          catalogFiles: [],
        });

        const { contact, conversation } = await createConversation(
          tenantBId,
          `5511985${String(seed).slice(-6)}`,
        );

        const result = await processAI.execute({
          tenantId: tenantBId,
          conversationId: conversation.id,
          contactId: contact.id,
          content: {
            type: 'TEXT',
            text: 'Qual é o horário de funcionamento de vocês?',
          },
        });

        expect(result).toEqual({ success: true });

        const prompt = capturedSystemPrompt();
        // Confirma que o prompt não tem horário configurado
        expect(prompt).not.toContain('Operating Hours:');

        const reply = await getAssistantReply(conversation.id);
        expect(reply.length).toBeGreaterThan(5);

        // IA não deve inventar um horário específico (formato HH:MM típico de horário de funcionamento)
        // quando não está configurado. Aceita apenas que a IA peça para confirmar ou diga não ter.
        // Nota: não assertamos ausência total de horas pois IA pode dizer "em breve" ou similar.
        // O que não pode aparecer é um horário assertivo como "atendemos das 08:00 às 18:00" sem base.
        expect(reply).not.toMatch(
          /atendemos das \d{2}:\d{2} (às|ate|a) \d{2}:\d{2}/i,
        );
      });
    });
  });
});
