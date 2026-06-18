import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { InventoryAsyncJobStatus } from '../infrastructure/persistence/repositories/InventoryAsyncJobsService';

describe('InventoryController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let authCookie: string;

  const ownerEmail = `inventory-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `iv${Date.now()}`;

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  async function waitForJobCompletion(jobId: string): Promise<any> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/inventory/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = response.body.status as InventoryAsyncJobStatus;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return response.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for inventory job ${jobId}`);
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
      .deleteMany({ where: { email: ownerEmail } })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Inventory Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Inventory Owner',
        email: ownerEmail,
        phone: '11970000061',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login();
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM inventory_schema.inventory_async_jobs
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM inventory_schema.inventory_items
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM catalog_schema.catalog_items
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM catalog_schema.catalog_categories
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: tenantId } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should sync inventory items and query current availability by name, sku and price', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Mercearia',
      })
      .expect(201);

    const catalogItemResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Cafe torrado 500g',
        basePrice: '13.90',
        categoryId: categoryResponse.body.id,
      })
      .expect(201);

    const firstSyncResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        catalogItemId: catalogItemResponse.body.id,
        sku: 'CAFE-500',
        externalReference: 'ERP-CAFE-500',
        name: 'Cafe torrado 500g',
        availableQuantity: 12,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '14.90',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    expect(firstSyncResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        catalogItemId: catalogItemResponse.body.id,
        sku: 'CAFE-500',
        availableQuantity: 12,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '14.90',
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'ARROZ-1KG',
        externalReference: 'ERP-ARROZ-1KG',
        name: 'Arroz branco 1kg',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
        currentPrice: '8.50',
        source: 'IMPORT_SNAPSHOT',
      })
      .expect(201);

    const searchByNameResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=cafe`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(searchByNameResponse.body).toEqual([
      expect.objectContaining({
        sku: 'CAFE-500',
        currentPrice: '14.90',
      }),
    ]);

    const searchAvailableOnlyResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?availableOnly=true`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(searchAvailableOnlyResponse.body).toEqual([
      expect.objectContaining({
        sku: 'CAFE-500',
        availabilityStatus: 'AVAILABLE',
      }),
    ]);

    const searchBySkuResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=ARROZ-1KG`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(searchBySkuResponse.body).toEqual([
      expect.objectContaining({
        sku: 'ARROZ-1KG',
        availabilityStatus: 'UNAVAILABLE',
      }),
    ]);

    const secondSyncResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        catalogItemId: catalogItemResponse.body.id,
        sku: 'CAFE-500',
        externalReference: 'ERP-CAFE-500',
        name: 'Cafe torrado 500g',
        availableQuantity: 5,
        availabilityStatus: 'LOW_STOCK',
        currentPrice: '15.50',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    expect(secondSyncResponse.body).toEqual(
      expect.objectContaining({
        id: firstSyncResponse.body.id,
        sku: 'CAFE-500',
        availableQuantity: 5,
        availabilityStatus: 'LOW_STOCK',
        currentPrice: '15.50',
      }),
    );
  });

  it('should register and list inventory connections for manual, csv and external sync modes', async () => {
    const manualConnectionResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({
        sourceType: 'MANUAL_SNAPSHOT',
        providerName: 'Painel interno',
        config: {
          notes: 'Operação manual pelo time da loja',
        },
      })
      .expect(201);

    const csvConnectionResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({
        sourceType: 'CSV_IMPORT',
        providerName: 'Planilha de estoque',
        config: {
          filePattern: 'estoque-diario.csv',
        },
      })
      .expect(201);

    const erpConnectionResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({
        sourceType: 'ERP_SYNC',
        providerName: 'Tiny ERP',
        config: {
          baseUrl: 'https://erp.test/api',
          syncWindowMinutes: 15,
        },
      })
      .expect(201);

    expect(manualConnectionResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        sourceType: 'MANUAL_SNAPSHOT',
        providerName: 'Painel interno',
        status: 'ACTIVE',
      }),
    );

    expect(csvConnectionResponse.body).toEqual(
      expect.objectContaining({
        sourceType: 'CSV_IMPORT',
        providerName: 'Planilha de estoque',
      }),
    );

    expect(erpConnectionResponse.body).toEqual(
      expect.objectContaining({
        sourceType: 'ERP_SYNC',
        providerName: 'Tiny ERP',
      }),
    );

    const connectionsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(connectionsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'MANUAL_SNAPSHOT',
          providerName: 'Painel interno',
        }),
        expect.objectContaining({
          sourceType: 'CSV_IMPORT',
          providerName: 'Planilha de estoque',
        }),
        expect.objectContaining({
          sourceType: 'ERP_SYNC',
          providerName: 'Tiny ERP',
        }),
      ]),
    );
  });

  it('should enqueue an inventory report job and download the csv', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'REL-EST-001',
        externalReference: 'REL-001',
        name: 'Produto relatorio estoque',
        availableQuantity: 8,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '19.90',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/report-jobs`)
      .set('Cookie', [authCookie])
      .send({
        query: 'REL-EST-001',
        availableOnly: true,
        statuses: ['AVAILABLE'],
      })
      .expect(202);

    expect(startResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'EXPORT_INVENTORY_REPORT_CSV',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const reportJob = await waitForJobCompletion(startResponse.body.id);
    expect(reportJob.status).toBe('COMPLETED');
    expect(reportJob.fileName).toContain('relatorio-estoque-');

    const downloadResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/inventory/jobs/${reportJob.id}/download`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.header['content-type']).toContain('text/csv');
    expect(downloadResponse.text).toContain('Produto relatorio estoque');
    expect(downloadResponse.text).toContain('REL-EST-001');
  });
});
