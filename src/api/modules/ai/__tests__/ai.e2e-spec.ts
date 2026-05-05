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
import { AddPromotionUseCase } from '@modules/tenant/application/use-cases/AddPromotionUseCase';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { AI_ENGINE, IAIEngine } from '../application/ports/IAIEngine';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';

describe('AIModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processAI: IProcessAIResponseUseCase;
  let chatHistory: IChatHistoryRepository;
  let tenantId: string;

  const ownerEmail = `ai-e2e-owner-${Date.now()}@test.com`;
  const createdConversationIds: string[] = [];
  const generatedCnpj = makeValidCnpj(Date.now());

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

  async function seedConversation() {
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: `AI Lead ${createdConversationIds.length + 1}`,
        phone: `55119988${String(Date.now() + createdConversationIds.length).slice(-6)}`,
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

    return {
      contactId: contact.id,
      conversationId: conversation.id,
    };
  }

  async function waitForUsageIncrease(previousTokensUsed: number) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const usage = await prisma.usageRecord.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      });

      if ((usage?.aiTokensUsed || 0) > previousTokensUsed) {
        return usage;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return prisma.usageRecord.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    processAI = app.get(IProcessAIResponseUseCase);
    chatHistory = app.get(CHAT_HISTORY_REPOSITORY);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'AI E2E Store',
      cnpj: generatedCnpj,
      ownerName: 'AI Test Owner',
      ownerEmail,
      ownerPhone: '11988887777',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });
    tenantId = tenant.id;

    const configureAI = app.get<IConfigureAIUseCase>(IConfigureAIUseCase);
    await configureAI.execute({
      tenantId,
      systemPrompt: 'You are a senior seller.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 1000,
      confidenceThreshold: 0.7,
      escalationMessage: 'Vou transferir voce para um especialista humano.',
      businessRules: ['Sempre oferecer a proxima ação comercial'],
    });

    const updateBusiness = app.get<IUpdateBusinessDataUseCase>(
      IUpdateBusinessDataUseCase,
    );
    await updateBusiness.execute({
      tenantId,
      businessType: 'Barbearia',
      description: 'Barbearia premium com atendimento personalizado',
      services: 'Corte masculino, Barba, Pigmentação',
      catalogUrl: 'https://barbeariatest.com/serviços',
      operatingHours: {
        seg: { open: '09:00', close: '18:00' },
        ter: { open: '09:00', close: '18:00' },
      },
    });

    const addPromotion = app.get(AddPromotionUseCase);
    await addPromotion.execute({
      tenantId,
      title: 'Combo Barba e Corte',
      description: '20 por cento de desconto',
      value: '59.90',
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    for (const conversationId of createdConversationIds) {
      await chatHistory.clearHistory(conversationId).catch(() => { });
    }
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.message
        .deleteMany({
          where: {
            conversation: {
              tenantId,
            },
          },
        })
        .catch(() => { });
      await prisma.conversation.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.salesMetric.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.usageRecord.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.aIConfig.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should hand off when the lead explicitly asks for a human', async () => {
    const { conversationId, contactId } = await seedConversation();
    const aiEngine = app.get<IAIEngine>(AI_ENGINE);
    const checkQuotaUseCase = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);

    jest.spyOn(checkQuotaUseCase, 'execute').mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    } as any);
    jest.spyOn(aiEngine, 'generateResponse').mockResolvedValue({
      text: 'Claro, posso ajudar.',
      tokensUsed: 32,
      confidence: 0.95,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
    });

    const result = await processAI.execute({
      tenantId,
      conversationId,
      contactId,
      content: { type: 'TEXT', text: 'Quero falar com um atendente humano' },
    });

    expect(result).toEqual({
      success: false,
      error: 'HANDOFF_REQUIRED',
      message: 'Conversation escalated to a human agent.',
    });

    const history = await chatHistory.getHistory(conversationId);
    expect(history).toHaveLength(2);
    expect(history[1]?.content).toContain('especialista humano');
  });

  it('should hand off when the AI response confidence is below the threshold', async () => {
    const { conversationId, contactId } = await seedConversation();
    const aiEngine = app.get<IAIEngine>(AI_ENGINE);
    const checkQuotaUseCase = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);

    jest.spyOn(checkQuotaUseCase, 'execute').mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    } as any);
    jest.spyOn(aiEngine, 'generateResponse').mockResolvedValue({
      text: 'não tenho certeza absoluta.',
      tokensUsed: 18,
      confidence: 0.4,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
    });

    const result = await processAI.execute({
      tenantId,
      conversationId,
      contactId,
      content: { type: 'TEXT', text: 'Quanto custa o serviço premium?' },
    });

    expect(result.error).toBe('HANDOFF_REQUIRED');

    const history = await chatHistory.getHistory(conversationId);
    expect(history).toHaveLength(2);
    expect(history[1]?.content).toContain('especialista humano');
  });

  it('should replace the payment tag with a real payment link and track sales metrics', async () => {
    const { conversationId, contactId } = await seedConversation();
    const aiEngine = app.get<IAIEngine>(AI_ENGINE);
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    const checkQuotaUseCase = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);

    jest.spyOn(checkQuotaUseCase, 'execute').mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    } as any);
    jest.spyOn(aiEngine, 'generateResponse').mockResolvedValue({
      text: 'Segue o link para pagamento: [PAYMENT_LINK: Corte Premium, 59.90]',
      tokensUsed: 44,
      confidence: 0.92,
      finishReason: 'stop',
      intent: 'PURCHASE',
      sentiment: 'POSITIVE',
    });
    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-ai-e2e',
      url: 'https://pay.test/plink-ai-e2e',
    });

    const result = await processAI.execute({
      tenantId,
      conversationId,
      contactId,
      content: { type: 'TEXT', text: 'Quero fechar agora' },
    });

    expect(result).toEqual({ success: true });

    const history = await chatHistory.getHistory(conversationId);
    expect(history).toHaveLength(2);
    expect(history[1]?.content).toContain('https://pay.test/plink-ai-e2e');
    expect(history[1]?.content).not.toContain('[PAYMENT_LINK:');

    const metric = await prisma.salesMetric.findFirst({
      where: { tenantId },
      orderBy: { date: 'desc' },
    });
    expect(metric?.paymentLinksGenerated).toBeGreaterThanOrEqual(1);
    expect(Number(metric?.estimatedRevenue)).toBeGreaterThanOrEqual(59.9);
  });

  it('should save a fallback message when the AI provider fails', async () => {
    const { conversationId, contactId } = await seedConversation();
    const aiEngine = app.get<IAIEngine>(AI_ENGINE);
    const checkQuotaUseCase = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);

    jest.spyOn(checkQuotaUseCase, 'execute').mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    } as any);
    jest
      .spyOn(aiEngine, 'generateResponse')
      .mockRejectedValue(new Error('DeepSeek timeout'));

    const result = await processAI.execute({
      tenantId,
      conversationId,
      contactId,
      content: { type: 'TEXT', text: 'Voce esta online?' },
    });

    expect(result).toEqual({
      success: false,
      error: 'AI_PROVIDER_ERROR',
      message: 'Error communicating with AI Provider',
    });

    const history = await chatHistory.getHistory(conversationId);
    expect(history).toHaveLength(2);
    expect(history[1]?.content).toContain('instabilidades');
  });

  it('should debit ai token usage after a successful AI response', async () => {
    const { conversationId, contactId } = await seedConversation();
    const aiEngine = app.get<IAIEngine>(AI_ENGINE);
    const checkQuotaUseCase = app.get<ICheckQuotaUseCase>(ICheckQuotaUseCase);

    jest.spyOn(checkQuotaUseCase, 'execute').mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    } as any);
    jest.spyOn(aiEngine, 'generateResponse').mockResolvedValue({
      text: 'Claro, posso te explicar como funciona.',
      tokensUsed: 37,
      confidence: 0.91,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'POSITIVE',
    });

    const beforeUsage = await prisma.usageRecord.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    await processAI.execute({
      tenantId,
      conversationId,
      contactId,
      content: { type: 'TEXT', text: 'Quero entender melhor o serviço' },
    });

    const afterUsage = await waitForUsageIncrease(beforeUsage?.aiTokensUsed || 0);

    expect(afterUsage).toBeDefined();
    expect(afterUsage?.aiTokensUsed || 0).toBeGreaterThan(
      beforeUsage?.aiTokensUsed || 0,
    );
  });
});
