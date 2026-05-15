import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('InventoryTenantIsolation (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let cookieA: string;
  let cookieB: string;

  const password = 'SenhaForte123!';
  const ts = Date.now();

  const ownerA = `iso-a-${ts}@test.com`;
  const ownerB = `iso-b-${ts}@test.com`;
  const cnpjA = `ia${ts}`;
  const cnpjB = `ib${ts}`;

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.get('Set-Cookie')![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email: { in: [ownerA, ownerB] } } }).catch(() => { });

    const passwordHash = await bcrypt.hash(password, 10);

    const tenantA = await prisma.tenant.create({ data: { companyName: 'Tenant A Store', cnpj: cnpjA, plan: 'ESSENCIAL' } });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({ data: { companyName: 'Tenant B Store', cnpj: cnpjB, plan: 'ESSENCIAL' } });
    tenantBId = tenantB.id;

    await prisma.user.create({ data: { tenantId: tenantAId, name: 'Owner A', email: ownerA, phone: '11970000070', passwordHash, role: 'OWNER' } });
    await prisma.user.create({ data: { tenantId: tenantBId, name: 'Owner B', email: ownerB, phone: '11970000071', passwordHash, role: 'OWNER' } });

    cookieA = await login(ownerA);
    cookieB = await login(ownerB);
  });

  afterAll(async () => {
    for (const tid of [tenantAId, tenantBId]) {
      if (!tid) continue;
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_async_jobs WHERE tenant_id = ${tid}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tid}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${tid}::uuid`).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId: tid } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId: tid } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tid } }).catch(() => { });
    }
    if (app) await app.close();
  });

  // ─── INV-T-091a: itens de tenant A não visíveis para tenant B ────────────

  it('INV-T-091a: item sincronizado em tenant A não aparece para tenant B', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/inventory/items/sync`)
      .set('Cookie', [cookieA])
      .send({ sku: 'ISO-SKU-A001', name: 'Item do Tenant A', availableQuantity: 10, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(201);

    const resB = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}/inventory/items?query=ISO-SKU-A001`)
      .set('Cookie', [cookieB])
      .expect(200);

    expect(resB.body).toHaveLength(0);

    const resA = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}/inventory/items?query=ISO-SKU-A001`)
      .set('Cookie', [cookieA])
      .expect(200);

    expect(resA.body).toHaveLength(1);
  });

  // ─── INV-T-091b: conexões de tenant A não visíveis para tenant B ──────────

  it('INV-T-091b: conexão criada em tenant A não aparece no listing de tenant B', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/inventory/connections`)
      .set('Cookie', [cookieA])
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: 'Conn Isolada A', config: {} })
      .expect(201);

    const resB = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}/inventory/connections`)
      .set('Cookie', [cookieB])
      .expect(200);

    const names = resB.body.map((c: any) => c.providerName);
    expect(names).not.toContain('Conn Isolada A');
  });

  // ─── INV-T-091c: tenant B não pode acionar sync de conexão de tenant A ───

  it('INV-T-091c: tenant B tenta acionar sync de conexão de tenant A e recebe 403', async () => {
    const connRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/inventory/connections`)
      .set('Cookie', [cookieA])
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: 'Conn A para sync attack', config: {} })
      .expect(201);

    const connAId = connRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/inventory/connections/${connAId}/sync`)
      .set('Cookie', [cookieB])
      .expect(403);
  });
});
