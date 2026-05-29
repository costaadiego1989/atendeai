import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { buildRecoveryPaymentReference } from '@shared/contracts/payment-references';

describe('MessagingController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let conversationId: string;
  let otherConversationId: string;
  let freshContactId: string;
  let activeContactId: string;
  let authCookie: string;

  const ownerEmail = 'messaging-controller-owner@test.com';
  const otherOwnerEmail = 'messaging-controller-other@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = `mcw${Date.now()}`;
  const otherTenantCnpj = `mcw${Date.now() + 1}`;

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [ownerEmail, otherOwnerEmail],
          },
        },
      })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Messaging Controller Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Messaging Controller Other Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Messaging Controller Owner',
          email: ownerEmail,
          phone: '11960000001',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11960000002',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    authCookie = await login(ownerEmail);

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Controller',
        phone: '551199991111',
        stage: 'LEAD',
      },
    });
    activeContactId = contact.id;

    const archivedContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Archived',
        phone: '551199992222',
        stage: 'LEAD',
      },
    });

    const otherContact = await prisma.contact.create({
      data: {
        tenantId: otherTenantId,
        name: 'Other Lead',
        phone: '551199993333',
        stage: 'LEAD',
      },
    });

    const freshContact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Fresh CRM Contact',
        phone: '551199994444',
        stage: 'PROSPECT',
      },
    });
    freshContactId = freshContact.id;

    const activeConversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });
    conversationId = activeConversation.id;

    await prisma.message.createMany({
      data: [
        {
          conversationId,
          direction: 'INBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Oi, preciso de ajuda' },
          sentBy: 'CONTACT',
          externalId: `mc-in-${Date.now()}`,
        },
        {
          conversationId,
          direction: 'OUTBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Claro, posso ajudar' },
          sentBy: 'AI',
          externalId: `mc-out-${Date.now()}`,
        },
      ],
    });

    await prisma.conversation.create({
      data: {
        tenantId,
        contactId: archivedContact.id,
        channel: 'WHATSAPP',
        status: 'ARCHIVED',
      },
    });

    const otherConversation = await prisma.conversation.create({
      data: {
        tenantId: otherTenantId,
        contactId: otherContact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });
    otherConversationId = otherConversation.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.message
        .deleteMany({
          where: {
            conversation: {
              tenantId: {
                in: [tenantId, otherTenantId].filter(Boolean),
              },
            },
          },
        })
        .catch(() => {});
      await prisma.paymentLink
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.contact
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({
          where: {
            id: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
    }
  });

  it('should list conversations with pagination and status filter', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations?page=1&limit=1&status=ACTIVE`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 1,
        totalPages: expect.any(Number),
      }),
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: conversationId,
        contactName: 'Lead Controller',
        contactPhone: '551199991111',
        status: 'ACTIVE',
        lastMessage: expect.objectContaining({
          content: 'Claro, posso ajudar',
          direction: 'OUTBOUND',
        }),
      }),
    );
  });

  it('should return conversation history with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/messages?page=1&limit=1`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body.meta).toEqual(
      expect.objectContaining({
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
      }),
    );
    expect(response.body.data).toHaveLength(1);
  });

  it('should persist a human reply and queue it for delivery', async () => {
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/messages`,
      )
      .set('Cookie', [authCookie])
      .send({
        content: {
          type: 'TEXT',
          text: 'Mensagem do atendente',
        },
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: 'QUEUED',
      }),
    );

    const storedMessage = await prisma.message.findFirst({
      where: {
        conversationId,
        direction: 'OUTBOUND',
        sentBy: 'HUMAN',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(storedMessage).toBeDefined();
    expect((storedMessage?.content as any).text).toBe('Mensagem do atendente');
  });

  it('should update the conversation status for human handoff and archive flows', async () => {
    const handoffResponse = await request(app.getHttpServer())
      .patch(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/status`,
      )
      .set('Cookie', [authCookie])
      .send({ status: 'PENDING_HUMAN' })
      .expect(200);

    expect(handoffResponse.body).toEqual(
      expect.objectContaining({
        id: conversationId,
        status: 'PENDING_HUMAN',
      }),
    );

    const archivedResponse = await request(app.getHttpServer())
      .patch(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/status`,
      )
      .set('Cookie', [authCookie])
      .send({ status: 'ARCHIVED' })
      .expect(200);

    expect(archivedResponse.body).toEqual(
      expect.objectContaining({
        id: conversationId,
        status: 'ARCHIVED',
      }),
    );
  });

  it('should open an existing conversation or create a new one by contact', async () => {
    const existingResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/open-by-contact`)
      .set('Cookie', [authCookie])
      .send({
        contactId: freshContactId,
        channel: 'WHATSAPP',
      })
      .expect(201);

    expect(existingResponse.body).toEqual(
      expect.objectContaining({
        contactId: freshContactId,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        created: true,
      }),
    );

    const secondResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/open-by-contact`)
      .set('Cookie', [authCookie])
      .send({
        contactId: freshContactId,
        channel: 'WHATSAPP',
      })
      .expect(201);

    expect(secondResponse.body).toEqual(
      expect.objectContaining({
        contactId: freshContactId,
        conversationId: existingResponse.body.conversationId,
        created: false,
      }),
    );
  });

  it('should reject cross-tenant access to conversations', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/conversations`)
      .set('Cookie', [authCookie])
      .expect(401);

    await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${otherTenantId}/conversations/${otherConversationId}/messages`,
      )
      .set('Cookie', [authCookie])
      .expect(401);
  });

  it('should allow sale attribution when the conversation already has a confirmed payment', async () => {
    await prisma.paymentLink.create({
      data: {
        tenantId,
        providerLinkId: 'provider-paid-1',
        externalId: `sales-charge|${tenantId}|paid-link-${Date.now()}`,
        name: 'Proposta aceite',
        label: 'Proposta aceita',
        value: 345,
        url: 'https://pay.test/paid-link',
        billingType: 'PIX',
        status: 'PAID',
        source: 'MANUAL',
        resourceType: 'PAYMENT',
        contactId: activeContactId,
        conversationId,
      },
    });

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/sale-attribution`,
      )
      .set('Cookie', [authCookie])
      .send({})
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        approved: true,
        conversationId,
        saleAmount: '345',
        aiValidationStatus: 'APPROVED',
      }),
    );

    const saleEvent = await prisma.conversationSaleEvent.findFirst({
      where: {
        tenantId,
        conversationId,
        lifecycleStatus: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(saleEvent).toBeDefined();
    expect(saleEvent?.metadata).toEqual(
      expect.objectContaining({
        objectiveEvidence: expect.objectContaining({
          source: 'PAYMENT_CONFIRMED',
        }),
      }),
    );
  });

  it('should not allow sale attribution when the confirmed payment belongs to recovery', async () => {
    const recoveryConversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: activeContactId,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    await prisma.paymentLink.create({
      data: {
        tenantId,
        providerLinkId: 'provider-recovery-1',
        externalId: buildRecoveryPaymentReference(tenantId, `paid-link-${Date.now()}`),
        name: 'Cobrança em aberto',
        label: 'Recovery',
        value: 199,
        url: 'https://pay.test/recovery-link',
        billingType: 'PIX',
        status: 'PAID',
        source: 'MANUAL',
        resourceType: 'PAYMENT',
        contactId: activeContactId,
        conversationId: recoveryConversation.id,
      },
    });

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${recoveryConversation.id}/sale-attribution`,
      )
      .set('Cookie', [authCookie])
      .send({})
      .expect(201);

    expect(response.body).toEqual({
      approved: false,
      reason:
        'Pagamento confirmado em recovery conta como receita recuperada, não como nova venda.',
      confidence: 1,
      conversationId: recoveryConversation.id,
      commercialKind: 'RECOVERY',
      commercialStatus: 'RECOVERED',
      evidenceSource: 'PAYMENT_CONFIRMED',
    });

    const saleEvent = await prisma.conversationSaleEvent.findFirst({
      where: {
        tenantId,
        conversationId: recoveryConversation.id,
        lifecycleStatus: 'ACTIVE',
      },
    });

    expect(saleEvent).toBeNull();
  });
});
