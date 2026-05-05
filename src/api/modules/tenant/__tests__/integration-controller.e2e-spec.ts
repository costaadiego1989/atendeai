import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('IntegrationController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let apiKey: string;

  const externalCnpj = '00.000.001/0001-36';
  const subscribeCnpj = '06.990.590/0001-23';
  const existingEmail = 'external-owner@test.com';
  const subscribeEmail = 'subscribe-owner@test.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
            in: [existingEmail, subscribeEmail],
          },
        },
      })
      .catch(() => { });

    await prisma.tenant
      .deleteMany({
        where: {
          cnpj: {
            in: [externalCnpj, subscribeCnpj],
          },
        },
      })
      .catch(() => { });

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'External Config Store',
        cnpj: externalCnpj,
        plan: 'ESSENCIAL',
        apiKey: '11111111-1111-1111-1111-111111111111',
        businessType: 'Loja',
        description: 'Descrição da loja externa',
        catalogUrl: 'https://catalog.external',
        promotions: [
          {
            title: 'Promo Integração',
            description: 'Descrição promocional para integração',
            value: '15%',
          },
        ],
        operatingHours: {
          monday: {
            open: '08:00',
            close: '18:00',
          },
        },
      },
    });
    tenantId = tenant.id;
    apiKey = tenant.apiKey;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Existing External Owner',
        email: existingEmail,
        phone: '11970000020',
        passwordHash: 'hashed-password',
        role: 'OWNER',
      },
    });
  });

  afterAll(async () => {
    await prisma.subscription
      .deleteMany({ where: { tenantId } })
      .catch(() => { });
    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [existingEmail, subscribeEmail],
          },
        },
      })
      .catch(() => { });
    await prisma.tenant
      .deleteMany({
        where: {
          cnpj: {
            in: [externalCnpj, subscribeCnpj],
          },
        },
      })
      .catch(() => { });
  });

  it('should return external store config when the API key is valid', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenant/external/config')
      .set('x-api-key', apiKey)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        companyName: 'External Config Store',
        businessType: 'Loja',
        description: 'Descrição da loja externa',
        catalogUrl: 'https://catalog.external',
        promotions: [
          expect.objectContaining({
            title: 'Promo Integração',
          }),
        ],
      }),
    );
  });

  it('should reject external config requests without API key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenant/external/config')
      .expect(401);
  });

  it('should reject external config requests with invalid API key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenant/external/config')
      .set('x-api-key', '00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('should subscribe a new external store and return the generated api key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/tenant/external/subscribe')
      .send({
        companyName: 'Subscribed Store',
        cnpj: subscribeCnpj,
        ownerName: 'Subscribed Owner',
        ownerEmail: subscribeEmail,
        ownerPhone: '11970000021',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        apiKey: expect.any(String),
      }),
    );

    const tenant = await prisma.tenant.findUnique({
      where: { cnpj: subscribeCnpj },
    });

    expect(tenant).not.toBeNull();
    expect(tenant?.apiKey).toBe(response.body.apiKey);
  });

  it('should reject a repeated external subscription', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenant/external/subscribe')
      .send({
        companyName: 'Subscribed Store',
        cnpj: subscribeCnpj,
        ownerName: 'Subscribed Owner',
        ownerEmail: subscribeEmail,
        ownerPhone: '11970000021',
      })
      .expect(409);
  });
});
