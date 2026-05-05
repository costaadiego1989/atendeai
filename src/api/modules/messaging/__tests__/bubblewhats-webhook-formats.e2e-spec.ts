import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { WhatsAppConfig } from '@modules/tenant/domain/entities/WhatsAppConfig';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

describe('BubbleWhats webhook formats (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantRepository: ITenantRepository;
  let tenantId: string;
  let authCookies: string[];
  const seed = Date.now();

  const ownerEmail = 'bubblewhats-formats@test.com';
  const ownerPassword = 'SenhaForte123!';
  const bubbleWhatsId = `bw-e2e-${seed}`;
  const whatsappNumber = `55119${String(seed).slice(-8)}`;
  const testCnpj = generateValidCnpj(Date.now());

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

  async function waitForConversation(phone: string) {
    for (let i = 0; i < 10; i++) {
      const contact = await (prisma.contact as any).findFirst({
        where: { tenantId, phone },
      });

      if (contact) {
        const conversation = await (prisma.conversation as any).findFirst({
          where: { tenantId, contactId: contact.id },
        });

        if (conversation) {
          return { contact, conversation };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return null;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    tenantRepository = app.get<ITenantRepository>(TENANT_REPOSITORY);

    await (prisma.message as any)
      .deleteMany({
        where: {
          conversation: {
            tenant: {
              users: {
                some: {
                  email: ownerEmail,
                },
              },
            },
          },
        },
      })
      .catch(() => {});
    await (prisma.conversation as any)
      .deleteMany({
        where: {
          tenant: {
            users: {
              some: {
                email: ownerEmail,
              },
            },
          },
        },
      })
      .catch(() => {});
    await (prisma.contact as any)
      .deleteMany({
        where: {
          tenant: {
            users: {
              some: {
                email: ownerEmail,
              },
            },
          },
        },
      })
      .catch(() => {});
    await (prisma.whatsAppConfig as any)
      .deleteMany({
        where: {
          tenant: {
            users: {
              some: {
                email: ownerEmail,
              },
            },
          },
        },
      })
      .catch(() => {});
    await (prisma.subscription as any)
      .deleteMany({
        where: {
          tenant: {
            users: {
              some: {
                email: ownerEmail,
              },
            },
          },
        },
      })
      .catch(() => {});
    await (prisma.user as any)
      .deleteMany({ where: { email: ownerEmail } })
      .catch(() => {});
    await (prisma.tenant as any)
      .deleteMany({ where: { cnpj: testCnpj } })
      .catch(() => {});

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'BubbleWhats Formats Store',
      cnpj: testCnpj,
      ownerName: 'BubbleWhats Owner',
      ownerEmail,
      ownerPhone: '11955554444',
      ownerPassword,
      plan: 'ESSENCIAL',
    });
    tenantId = tenant.id;

    const savedTenant = await tenantRepository.findById(tenantId);
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: bubbleWhatsId,
        token: 'tenant-token-formats',
        apiUrl: `https://${bubbleWhatsId}.bubblewhats.com`,
      },
      whatsappNumber,
      webhookSecret: null,
    });
    whatsAppConfig.activate();
    savedTenant!.configureWhatsApp(whatsAppConfig);
    await tenantRepository.save(savedTenant!);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        password: ownerPassword,
      })
      .expect(200);

    authCookies = loginResponse.get('Set-Cookie') || [];
  });

  afterAll(async () => {
    if (tenantId) {
      await (prisma.message as any)
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await (prisma.conversation as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.contact as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.subscription as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.whatsAppConfig as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.user as any)
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await (prisma.tenant as any)
        .delete({ where: { id: tenantId } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should persist a conversation from the native BubbleWhats payload format', async () => {
    const messageId = `native-${Date.now()}`;
    const body = {
      deviceID: bubbleWhatsId,
      messages: [
        {
          key: {
            remoteJid: '5511999997001@s.whatsapp.net',
            id: messageId,
            fromMe: false,
          },
          message: {
            conversation: 'Oi, cheguei pelo formato nativo',
          },
          messageTimestamp: 1710000000,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send(body)
      .expect(200);

    const persisted = await waitForConversation('5511999997001');

    expect(persisted).not.toBeNull();

    const historyResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations/${persisted!.conversation.id}/messages?page=1&limit=20`,
      )
      .set('Cookie', authCookies)
      .expect(200);

    const storedMessage = await (prisma.message as any).findFirst({
      where: {
        conversationId: persisted!.conversation.id,
        direction: 'INBOUND',
        externalId: messageId,
      },
    });

    expect(storedMessage).toBeDefined();
    expect(historyResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'INBOUND',
          content: expect.objectContaining({
            text: 'Oi, cheguei pelo formato nativo',
          }),
        }),
      ]),
    );
  });

  it('should persist a conversation from the messageContext BubbleWhats payload format', async () => {
    const body = {
      id: `ctx-${Date.now()}`,
      deviceID: bubbleWhatsId,
      fromNumber: '5511999997002',
      toNumber: whatsappNumber,
      messageContext: {
        key: {
          fromMe: false,
        },
        message: {
          extendedTextMessage: {
            text: 'Oi, cheguei pelo messageContext',
          },
        },
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .send(body)
      .expect(200);

    const persisted = await waitForConversation('5511999997002');

    expect(persisted).not.toBeNull();

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/conversations?page=1&limit=20&status=ACTIVE`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: persisted!.conversation.id,
          contactId: persisted!.contact.id,
          lastMessage: expect.objectContaining({
            content: 'Oi, cheguei pelo messageContext',
          }),
        }),
      ]),
    );
  });
});
