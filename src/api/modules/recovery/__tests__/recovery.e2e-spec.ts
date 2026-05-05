import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  AI_ENGINE,
  AIResponse,
  IAIEngine,
} from '../../ai/application/ports/IAIEngine';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
} from '../../payment/domain/ports/IPaymentGateway';
import { parseRecoveryPaymentReference } from '../application/services/RecoveryPaymentReference';
import { MessageReceivedIntegrationEvent } from '../../messaging/application/integration-events/publishers/MessageReceivedIntegrationEvent';

describe('RecoveryController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantId: string;
  let authCookie: string;
  const webhookSecret = 'recovery-webhook-secret';

  const ownerEmail = `recovery-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = generateValidCnpj(Date.now());

  function generateValidCnpj(seed: number): string {
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

  const paymentGatewayMock: jest.Mocked<IPaymentGateway> = {
    createCustomer: jest.fn(),
    getCustomer: jest.fn(),
    createSubaccount: jest.fn(),
    listSubaccounts: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    getSubscription: jest.fn(),
    createPayment: jest.fn(),
    deletePayment: jest.fn(),
    restorePayment: jest.fn(),
    createPaymentLink: jest.fn(async (data) => ({
      id: `plink-${Date.now()}`,
      url: `https://pay.test/${data.externalReference || 'recovery'}`,
    })),
    removePaymentLink: jest.fn(),
    restorePaymentLink: jest.fn(),
    parseWebhook: jest.fn((payload: any) => {
      if (!payload?.event || !payload?.payment?.id) {
        return null;
      }

      const rawReference = payload.payment.externalReference;
      const parsedReference = parseRecoveryPaymentReference(rawReference);

      return {
        provider: 'ASAAS',
        eventType:
          payload.event === 'PAYMENT_RECEIVED' ||
            payload.event === 'PAYMENT_CONFIRMED'
            ? 'PAYMENT_CONFIRMED'
            : payload.event,
        paymentId: payload.payment.id,
        tenantId: parsedReference?.tenantId || rawReference,
        amount: payload.payment.value,
        occurredAt: new Date(
          payload.payment.confirmedDate || payload.dateCreated || Date.now(),
        ),
        rawReference,
        rawPayload: payload,
      };
    }),
  };
  const aiEngineMock: jest.Mocked<IAIEngine> = {
    generateResponse: jest.fn(async (request): Promise<AIResponse> => {
      const payload = JSON.parse(request.userMessage);
      if (payload.assignedTags) {
        return {
          text: `Oi, ${payload.debtorName}. Identifiquei a pendencia${payload.chargeTitle ? ` referente a ${payload.chargeTitle}` : ''} e posso te ajudar a regularizar por aqui de forma simples.`,
          tokensUsed: 32,
          confidence: 0.9,
          finishReason: 'stop',
        };
      }

      if (
        typeof payload.customerMessage === 'string' &&
        payload.customerMessage.toLowerCase().includes('boleto')
      ) {
        return {
          text: JSON.stringify({
            suggestedReply:
              'Consigo te orientar por boleto tambem. Se quiser, eu organizo isso com voce agora.',
            suggestedNextAction:
              'Confirmar preferência por boleto e ajustar a abordagem de fechamento.',
          }),
          tokensUsed: 38,
          confidence: 0.91,
          finishReason: 'stop',
        };
      }

      if (payload.status === 'PROMISE_TO_PAY') {
        return {
          text: JSON.stringify({
            suggestedReply:
              'Perfeito, vou acompanhar por aqui e posso reenviar o link se precisar.',
            suggestedNextAction:
              'Registrar a promessa e acompanhar a confirmação do pagamento.',
          }),
          tokensUsed: 40,
          confidence: 0.92,
          finishReason: 'stop',
        };
      }

      return {
        text: JSON.stringify({
          suggestedReply:
            'Posso te explicar o valor e, se fizer sentido, te reenviar o link agora.',
          suggestedNextAction:
            'Entender a objeção do cliente e conduzir para pagamento.',
        }),
        tokensUsed: 40,
        confidence: 0.9,
        finishReason: 'stop',
      };
    }),
  };

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  function signPayload(body: Record<string, unknown>) {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  async function waitFor(
    assertion: () => Promise<void>,
    attempts = 20,
    intervalMs = 250,
  ) {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw lastError;
  }

  async function waitForAsyncJobCompletion(jobId: string) {
    await waitFor(async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/recovery/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      expect(['COMPLETED', 'FAILED']).toContain(response.body.status);
      expect(response.body.status).toBe('COMPLETED');
    });
  }

  beforeAll(async () => {
    process.env.ASAAS_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IPAYMENT_GATEWAY)
      .useValue(paymentGatewayMock)
      .overrideProvider(AI_ENGINE)
      .useValue(aiEngineMock)
      .compile();

    app = moduleFixture.createNestApplication();
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
    eventBus = app.get<IEventBus>(EVENT_BUS);

    await prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS recovery_schema
    `);
    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE recovery_schema.recovery_cases
      ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS debtor_company_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS debtor_document VARCHAR(30),
      ADD COLUMN IF NOT EXISTS charge_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS charge_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS charge_description TEXT,
      ADD COLUMN IF NOT EXISTS reference_period VARCHAR(30),
      ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS related_entity_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS related_entity_label VARCHAR(255),
      ADD COLUMN IF NOT EXISTS suggested_reply TEXT,
      ADD COLUMN IF NOT EXISTS suggested_next_action TEXT,
      ADD COLUMN IF NOT EXISTS guidance_generated_at TIMESTAMPTZ
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_recovery_cases_payment_reference
      ON recovery_schema.recovery_cases (payment_reference)
      WHERE payment_reference IS NOT NULL
    `);

    await prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS payment_schema
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS payment_schema.payment_webhook_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_key VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        tenant_id UUID NULL,
        raw_reference VARCHAR(255) NULL,
        signature TEXT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
        ignore_reason VARCHAR(100) NULL,
        processed_at TIMESTAMPTZ NULL,
        ignored_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_receipts_receipt_key_key
      ON payment_schema.payment_webhook_receipts (receipt_key)
    `);

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Recovery Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Recovery Owner',
        email: ownerEmail,
        phone: '11970000062',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login();
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.message
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => { });
      await prisma.conversation
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql`
          DELETE FROM recovery_schema.recovery_recurring_charge_runs
          WHERE tenant_id = ${tenantId}::uuid
        `)
        .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql`
          DELETE FROM recovery_schema.recovery_recurring_charges
          WHERE tenant_id = ${tenantId}::uuid
        `)
        .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql`
          DELETE FROM recovery_schema.recovery_async_jobs
          WHERE tenant_id = ${tenantId}::uuid
        `)
        .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql`
          DELETE FROM recovery_schema.recovery_cases
          WHERE tenant_id = ${tenantId}::uuid
        `)
        .catch(() => { });
      await prisma
        .$executeRaw(Prisma.sql`
          DELETE FROM payment_schema.payment_webhook_receipts
          WHERE tenant_id = ${tenantId}::uuid
        `)
        .catch(() => { });
      await prisma.contact
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should create recovery cases from crm contact or manual debtor and list the case portfolio', async () => {
    const contactResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Carlos Inadimplente',
        phone: '5511997771001',
        document: '12345678901',
        email: 'carlos@cliente.com',
        tags: ['mensalidade'],
      })
      .expect(201);

    const crmCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        contactId: contactResponse.body.id,
        debtorCompanyName: 'Academia Movimento',
        debtorDocument: '12345678000199',
        chargeType: 'MONTHLY_FEE',
        chargeTitle: 'Mensalidade de julho',
        chargeDescription: 'Plano premium da unidade Centro',
        referencePeriod: '2026-07',
        relatedEntityType: 'SUBSCRIPTION',
        relatedEntityId: 'sub-interna-100',
        relatedEntityLabel: 'Plano Premium Centro',
        amountDue: '189.90',
        dueDate: '2030-07-10',
        externalReference: 'ERP-CASE-100',
        assignedTags: ['atraso-30d'],
      })
      .expect(201);

    expect(crmCaseResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        contactId: contactResponse.body.id,
        debtorName: 'Carlos Inadimplente',
        phone: '5511997771001',
        debtorCompanyName: 'Academia Movimento',
        debtorDocument: '12345678000199',
        chargeType: 'MONTHLY_FEE',
        chargeTitle: 'Mensalidade de julho',
        chargeDescription: 'Plano premium da unidade Centro',
        referencePeriod: '2026-07',
        relatedEntityType: 'SUBSCRIPTION',
        relatedEntityId: 'sub-interna-100',
        relatedEntityLabel: 'Plano Premium Centro',
        source: 'CRM',
        status: 'READY_TO_CONTACT',
        amountDue: '189.90',
      }),
    );

    const manualCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Maria Manual',
        phone: '5511997771002',
        debtorCompanyName: 'Loja Central',
        chargeType: 'PRODUCT_ORDER',
        chargeTitle: 'Pedido 200',
        chargeDescription: 'Compra de materiais escolares',
        relatedEntityType: 'ORDER',
        relatedEntityId: 'pedido-200',
        relatedEntityLabel: 'Pedido #200',
        amountDue: '79.50',
        dueDate: '2030-07-20',
        externalReference: 'PLANILHA-200',
        assignedTags: ['lista-importada'],
      })
      .expect(201);

    expect(manualCaseResponse.body).toEqual(
      expect.objectContaining({
        debtorName: 'Maria Manual',
        phone: '5511997771002',
        debtorCompanyName: 'Loja Central',
        chargeType: 'PRODUCT_ORDER',
        chargeTitle: 'Pedido 200',
        source: 'MANUAL',
        status: 'READY_TO_CONTACT',
      }),
    );

    const allCasesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(allCasesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: crmCaseResponse.body.id,
          source: 'CRM',
        }),
        expect.objectContaining({
          id: manualCaseResponse.body.id,
          source: 'MANUAL',
        }),
      ]),
    );

    const crmCasesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases?source=CRM`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(crmCasesResponse.body).toEqual([
      expect.objectContaining({
        id: crmCaseResponse.body.id,
        source: 'CRM',
      }),
    ]);

    const readyCasesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases?status=READY_TO_CONTACT`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(readyCasesResponse.body).toHaveLength(2);
  });

  it('should export recovery reports asynchronously and download the csv', async () => {
    const firstCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Relatorio Maria',
        phone: '5511997771021',
        debtorCompanyName: 'Studio Relatorio',
        chargeType: 'MONTHLY_FEE',
        chargeTitle: 'Mensalidade atrasada',
        chargeDescription: 'Cliente entrou na carteira de cobrança',
        amountDue: '210.50',
        dueDate: '2030-09-10',
        externalReference: 'REL-001',
      })
      .expect(201);

    const secondCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Relatorio Paula',
        phone: '5511997771022',
        debtorCompanyName: 'Clinica Promessa',
        chargeType: 'CONSULTATION',
        chargeTitle: 'Consulta em aberto',
        chargeDescription: 'Cliente prometeu pagar amanha',
        amountDue: '89.90',
        dueDate: '2030-09-11',
        externalReference: 'REL-002',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantId}/recovery/cases/${secondCaseResponse.body.id}/status`)
      .set('Cookie', [authCookie])
      .send({
        status: 'PROMISE_TO_PAY',
        nextActionAt: '2030-09-12T14:00:00.000Z',
      })
      .expect(200);

    const jobResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/report-jobs`)
      .set('Cookie', [authCookie])
      .send({
        search: 'Relatorio',
      })
      .expect(202);

    expect(jobResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'EXPORT_RECOVERY_REPORT_CSV',
        status: expect.stringMatching(/QUEUED|PROCESSING|COMPLETED/),
      }),
    );

    await waitForAsyncJobCompletion(jobResponse.body.id);

    const completedJobResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/jobs/${jobResponse.body.id}`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(completedJobResponse.body.resultSummary).toEqual(
      expect.objectContaining({
        totalCases: 2,
        openCases: 2,
        promiseCases: 1,
        paidCases: 0,
      }),
    );

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/jobs/${jobResponse.body.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.headers['content-type']).toContain('text/csv');
    expect(downloadResponse.text).toContain('Relatorio Maria');
    expect(downloadResponse.text).toContain('Relatorio Paula');
    expect(downloadResponse.text).toContain('Mensalidade atrasada');
    expect(downloadResponse.text).toContain('Consulta em aberto');
    expect(downloadResponse.text).toContain('PROMISE_TO_PAY');
    expect(firstCaseResponse.body.id).toEqual(expect.any(String));
  });

  it('should trigger first recovery outreach, ensure crm contact and queue a whatsapp message', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Patricia Lista',
        phone: '5511997771004',
        debtorCompanyName: 'Clinica Bela Vida',
        chargeType: 'CONSULTATION',
        chargeTitle: 'Consulta em aberto',
        chargeDescription: 'Consulta de retorno não quitada',
        amountDue: '310.00',
        dueDate: '2030-08-01',
        assignedTags: ['importação'],
      })
      .expect(201);

    const outreachResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/outreach`)
      .set('Cookie', [authCookie])
      .send({
        messageText:
          'Oi, Patricia. Identificamos uma pendencia em aberto e posso te ajudar a regularizar por aqui.',
      })
      .expect(201);

    expect(outreachResponse.body).toEqual(
      expect.objectContaining({
        id: createCaseResponse.body.id,
        status: 'CONTACTED',
        contactId: expect.any(String),
        conversationId: expect.any(String),
        messageId: expect.any(String),
      }),
    );

    const persistedContact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: '5511997771004',
        },
      },
    });

    expect(persistedContact).not.toBeNull();
    expect(persistedContact?.name).toBe('Patricia Lista');

    const persistedConversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: persistedContact!.id,
      },
    });

    expect(persistedConversation).not.toBeNull();

    const persistedMessages = await prisma.message.findMany({
      where: {
        conversationId: persistedConversation!.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(persistedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'OUTBOUND',
          sentBy: 'SYSTEM',
        }),
      ]),
    );
  });

  it('should generate the first recovery outreach with AI when requested', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Carla AI',
        phone: '5511997771010',
        debtorCompanyName: 'Locadora Centro',
        chargeType: 'RENTAL',
        chargeTitle: 'Locação do equipamento XPTO',
        chargeDescription: 'Diaria pendente do equipamento XPTO',
        relatedEntityType: 'RENTAL_RESERVATION',
        relatedEntityId: 'rent-1010',
        relatedEntityLabel: 'Reserva XPTO',
        amountDue: '199.00',
        dueDate: '2030-08-05',
        assignedTags: ['atraso-60d'],
      })
      .expect(201);

    const outreachResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/outreach`,
      )
      .set('Cookie', [authCookie])
      .send({
        generateWithAI: true,
      })
      .expect(201);

    expect(outreachResponse.body).toEqual(
      expect.objectContaining({
        id: createCaseResponse.body.id,
        status: 'CONTACTED',
        outreachText: expect.stringContaining('Carla AI'),
      }),
    );
    expect(outreachResponse.body.outreachText).toContain('equipamento');

    const persistedContact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: '5511997771010',
        },
      },
    });

    const persistedConversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: persistedContact!.id,
      },
    });

    const persistedMessages = await prisma.message.findMany({
      where: {
        conversationId: persistedConversation!.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(persistedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'OUTBOUND',
          sentBy: 'SYSTEM',
          content: expect.objectContaining({
            text: expect.stringContaining('Carla AI'),
          }),
        }),
      ]),
    );
  });

  it('should update recovery case status, contact attempt and promise-to-pay follow-up', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Joana Follow Up',
        phone: '5511997771003',
        debtorCompanyName: 'Escola Futuro',
        chargeType: 'TUITION',
        chargeTitle: 'Parcela escolar',
        amountDue: '220.00',
        dueDate: '2030-07-25',
      })
      .expect(201);

    const contactedResponse = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/status`)
      .set('Cookie', [authCookie])
      .send({
        status: 'CONTACTED',
      })
      .expect(200);

    expect(contactedResponse.body).toEqual(
      expect.objectContaining({
        id: createCaseResponse.body.id,
        status: 'CONTACTED',
        lastContactedAt: expect.any(String),
      }),
    );

    const promiseToPayResponse = await request(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/status`)
      .set('Cookie', [authCookie])
      .send({
        status: 'PROMISE_TO_PAY',
        nextActionAt: '2030-07-28T15:00:00.000Z',
      })
      .expect(200);

    expect(promiseToPayResponse.body).toEqual(
      expect.objectContaining({
        id: createCaseResponse.body.id,
        status: 'PROMISE_TO_PAY',
        nextActionAt: '2030-07-28T15:00:00.000Z',
      }),
    );

    const promiseCasesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases?status=PROMISE_TO_PAY`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(promiseCasesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createCaseResponse.body.id,
          status: 'PROMISE_TO_PAY',
        }),
      ]),
    );
  });

  it('should generate a payment link and mark the recovery case as PAID after the Asaas webhook', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Fernanda Quitou',
        phone: '5511997771005',
        debtorCompanyName: 'Studio Pilates Viva',
        chargeType: 'MONTHLY_FEE',
        chargeTitle: 'Mensalidade em aberto',
        amountDue: '145.80',
        dueDate: '2030-08-10',
      })
      .expect(201);

    const paymentLinkResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/payment-link`,
      )
      .set('Cookie', [authCookie])
      .send({
        billingType: 'PIX',
      })
      .expect(201);

    expect(paymentLinkResponse.body).toEqual(
      expect.objectContaining({
        caseId: createCaseResponse.body.id,
        paymentLinkId: expect.any(String),
        url: expect.stringContaining('https://pay.test/'),
        paymentReference: `recovery|${tenantId}|${createCaseResponse.body.id}`,
        conversationId: expect.any(String),
        messageId: expect.any(String),
      }),
    );

    const persistedMessages = await prisma.message.findMany({
      where: {
        conversationId: paymentLinkResponse.body.conversationId,
      },
    });

    expect(persistedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'OUTBOUND',
          sentBy: 'SYSTEM',
          content: expect.objectContaining({
            text: expect.stringContaining(paymentLinkResponse.body.url),
          }),
        }),
      ]),
    );

    const webhookBody = {
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2030-08-09T12:00:00.000Z',
      payment: {
        id: 'pay-recovery-1',
        externalReference: paymentLinkResponse.body.paymentReference,
        value: 145.8,
        confirmedDate: '2030-08-09T12:05:00.000Z',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(webhookBody))
      .send(webhookBody)
      .expect(200, { received: true });

    await waitFor(async () => {
      const persistedCase = await prisma.recoveryCase.findUnique({
        where: {
          id: createCaseResponse.body.id,
        },
      });

      expect(persistedCase?.status).toBe('PAID');
      expect(persistedCase?.paymentReference).toBe(
        paymentLinkResponse.body.paymentReference,
      );
      expect(persistedCase?.paidAt?.toISOString()).toBe(
        '2030-08-09T12:05:00.000Z',
      );
    });
  });

  it('should schedule and cancel recurring recovery charges for a case', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Marina Recorrente',
        phone: '5511997771031',
        debtorCompanyName: 'Coworking Centro',
        chargeType: 'MEMBERSHIP',
        chargeTitle: 'Plano mensal em aberto',
        amountDue: '199.90',
        dueDate: '2030-09-10',
      })
      .expect(201);

    const scheduleResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/recurring-charges`,
      )
      .set('Cookie', [authCookie])
      .send({
        billingType: 'PIX',
        intervalDays: 7,
        maxOccurrences: 3,
        firstRunAt: '2030-09-11T13:00:00.000Z',
        messageTemplate:
          'Oi, {{nome}}. Reenviando {{titulo}} no valor {{valor}}: {{link}}',
      })
      .expect(201);

    expect(scheduleResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        tenantId,
        caseId: createCaseResponse.body.id,
        status: 'ACTIVE',
        billingType: 'PIX',
        intervalDays: 7,
        maxOccurrences: 3,
        occurrencesSent: 0,
        nextRunAt: '2030-09-11T13:00:00.000Z',
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/recurring-charges`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: scheduleResponse.body.id,
        status: 'ACTIVE',
      }),
    ]);

    const cancelResponse = await request(app.getHttpServer())
      .patch(
        `/api/v1/tenants/${tenantId}/recovery/recurring-charges/${scheduleResponse.body.id}/cancel`,
      )
      .set('Cookie', [authCookie])
      .send({
        reason: 'cliente pediu para pausar',
      })
      .expect(200);

    expect(cancelResponse.body).toEqual(
      expect.objectContaining({
        id: scheduleResponse.body.id,
        status: 'CANCELLED',
        nextRunAt: null,
        lastError: 'cliente pediu para pausar',
      }),
    );
  });

  it('should update recovery case status from inbound customer replies', async () => {
    const createNegotiatingCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Ricardo Negociação',
        phone: '5511997771006',
        debtorCompanyName: 'Construtora Sol',
        chargeType: 'SERVICE_INVOICE',
        chargeTitle: 'Parcela de serviço',
        amountDue: '99.90',
        dueDate: '2030-08-20',
      })
      .expect(201);

    const negotiatingOutreachResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createNegotiatingCaseResponse.body.id}/outreach`,
      )
      .set('Cookie', [authCookie])
      .send({
        messageText: 'Oi, Ricardo. Posso te ajudar a regularizar essa pendencia por aqui.',
      })
      .expect(201);

    await eventBus.publish(
      new MessageReceivedIntegrationEvent({
        tenantId,
        contactId: negotiatingOutreachResponse.body.contactId,
        conversationId: negotiatingOutreachResponse.body.conversationId,
        messageId: 'recovery-reply-negotiating',
        content: {
          type: 'TEXT',
          text: 'consigo parcelar esse valor?',
        },
        channel: 'WHATSAPP',
      }),
    );

    await waitFor(async () => {
      const caseDetailsResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/recovery/cases/${createNegotiatingCaseResponse.body.id}`,
        )
        .set('Cookie', [authCookie])
        .expect(200);

      expect(caseDetailsResponse.body.status).toBe('NEGOTIATING');
      expect(caseDetailsResponse.body.suggestedReply).toEqual(expect.any(String));
      expect(caseDetailsResponse.body.suggestedReply.length).toBeGreaterThan(0);
      expect(caseDetailsResponse.body.suggestedNextAction).toEqual(expect.any(String));
      expect(caseDetailsResponse.body.suggestedNextAction.length).toBeGreaterThan(0);
      expect(caseDetailsResponse.body.guidanceGeneratedAt).not.toBeNull();
      expect(caseDetailsResponse.body.debtorCompanyName).toBe('Construtora Sol');
      expect(caseDetailsResponse.body.chargeTitle).toBe('Parcela de serviço');
    });

    const createPromiseCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Bruna Promessa',
        phone: '5511997771007',
        debtorCompanyName: 'Clinica Horizonte',
        chargeType: 'CONSULTATION',
        chargeTitle: 'Sessao em aberto',
        amountDue: '130.00',
        dueDate: '2030-08-21',
      })
      .expect(201);

    const promiseOutreachResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createPromiseCaseResponse.body.id}/outreach`,
      )
      .set('Cookie', [authCookie])
      .send({
        messageText: 'Oi, Bruna. Te ajudo a regularizar esse valor por aqui.',
      })
      .expect(201);

    await eventBus.publish(
      new MessageReceivedIntegrationEvent({
        tenantId,
        contactId: promiseOutreachResponse.body.contactId,
        conversationId: promiseOutreachResponse.body.conversationId,
        messageId: 'recovery-reply-promise',
        content: {
          type: 'TEXT',
          text: 'vou pagar hoje no pix',
        },
        channel: 'WHATSAPP',
      }),
    );

    await waitFor(async () => {
      const persistedCase = (await prisma.recoveryCase.findUnique({
        where: {
          id: createPromiseCaseResponse.body.id,
        },
      })) as any;

      expect(persistedCase?.status).toBe('PROMISE_TO_PAY');
      expect(persistedCase?.suggestedReply).toEqual(expect.any(String));
      expect(persistedCase?.suggestedReply?.length).toBeGreaterThan(0);
      expect(persistedCase?.suggestedNextAction).toEqual(expect.any(String));
      expect(persistedCase?.suggestedNextAction?.length).toBeGreaterThan(0);
      expect(persistedCase?.guidanceGeneratedAt).not.toBeNull();
    });

    const createStopCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Paulo OptOut',
        phone: '5511997771008',
        debtorCompanyName: 'Auto Escola Norte',
        chargeType: 'INSTALLMENT',
        chargeTitle: 'Parcela 3/6',
        amountDue: '210.00',
        dueDate: '2030-08-22',
      })
      .expect(201);

    const stopOutreachResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createStopCaseResponse.body.id}/outreach`,
      )
      .set('Cookie', [authCookie])
      .send({
        messageText: 'Oi, Paulo. Me chama se quiser negociar essa pendencia.',
      })
      .expect(201);

    await eventBus.publish(
      new MessageReceivedIntegrationEvent({
        tenantId,
        contactId: stopOutreachResponse.body.contactId,
        conversationId: stopOutreachResponse.body.conversationId,
        messageId: 'recovery-reply-stop',
        content: {
          type: 'TEXT',
          text: 'pare de me mandar mensagem',
        },
        channel: 'WHATSAPP',
      }),
    );

    await waitFor(async () => {
      const persistedCase = (await prisma.recoveryCase.findUnique({
        where: {
          id: createStopCaseResponse.body.id,
        },
      })) as any;

      expect(persistedCase?.status).toBe('STOPPED');
      expect(persistedCase?.nextActionAt).toBeNull();
      expect(persistedCase?.suggestedReply).toBeNull();
      expect(persistedCase?.suggestedNextAction).toBeNull();
    });
  });

  it('should expose case guidance to the frontend and allow manual regeneration', async () => {
    const createCaseResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', [authCookie])
      .send({
        debtorName: 'Helena Guidance',
        phone: '5511997771009',
        debtorCompanyName: 'Consultorio Vida',
        chargeType: 'CONSULTATION',
        chargeTitle: 'Consulta particular',
        chargeDescription: 'Atendimento de especialidade',
        amountDue: '155.00',
        dueDate: '2030-08-23',
      })
      .expect(201);

    const outreachResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/outreach`,
      )
      .set('Cookie', [authCookie])
      .send({
        messageText: 'Oi, Helena. Posso te ajudar a regularizar essa pendencia.',
      })
      .expect(201);

    await eventBus.publish(
      new MessageReceivedIntegrationEvent({
        tenantId,
        contactId: outreachResponse.body.contactId,
        conversationId: outreachResponse.body.conversationId,
        messageId: 'recovery-reply-guidance',
        content: {
          type: 'TEXT',
          text: 'quero entender melhor esse valor',
        },
        channel: 'WHATSAPP',
      }),
    );

    await waitFor(async () => {
      const caseDetailsResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}`,
        )
        .set('Cookie', [authCookie])
        .expect(200);

      expect(caseDetailsResponse.body).toEqual(
        expect.objectContaining({
          id: createCaseResponse.body.id,
          status: 'NEGOTIATING',
          debtorCompanyName: 'Consultorio Vida',
          chargeType: 'CONSULTATION',
          chargeTitle: 'Consulta particular',
          suggestedReply: expect.any(String),
          suggestedNextAction: expect.any(String),
        }),
      );
    });

    const regeneratedGuidanceResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/recovery/cases/${createCaseResponse.body.id}/guidance`,
      )
      .set('Cookie', [authCookie])
      .send({
        customerMessage: 'prefiro boleto',
      })
      .expect(201);

    expect(regeneratedGuidanceResponse.body).toEqual(
      expect.objectContaining({
        id: createCaseResponse.body.id,
        suggestedReply: expect.stringContaining('boleto'),
        suggestedNextAction: expect.stringContaining('boleto'),
      }),
    );
  });
});
