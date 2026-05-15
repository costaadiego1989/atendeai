import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('InventoryProviderSync (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let authCookie: string;

  const ownerEmail = `provider-sync-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `ps${Date.now()}`;
  const originalFetch = global.fetch;

  async function login() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
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

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const tenant = await prisma.tenant.create({
      data: { companyName: 'Provider Sync Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { tenantId, name: 'Provider Owner', email: ownerEmail, phone: '11970000090', passwordHash, role: 'OWNER' },
    });

    authCookie = await login();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }
    if (app) await app.close();
  });

  // ─── INV-T-090: Bling provider sync ───────────────────────────────────────

  it('INV-T-090a: sync via Bling provider persiste itens no banco com sku, qty e status corretos', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 501, codigo: 'BLING-E2E-001', nome: 'Produto Bling E2E', estoque: { saldoVirtual: 15 }, preço: 49.9 },
            { id: 502, codigo: 'BLING-E2E-002', nome: 'Produto Zerado', estoque: { saldoVirtual: 0 }, preço: 29.9 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      }) as unknown as typeof fetch;

    const connRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({ sourceType: 'BLING', providerName: 'Bling', config: { accessToken: 'e2e-bling-tok' } })
      .expect(201);

    const connectionId = connRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections/${connectionId}/sync`)
      .set('Cookie', [authCookie])
      .expect(202);

    const itemsRes = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(itemsRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: 'BLING-E2E-001', availableQuantity: 15, availabilityStatus: 'AVAILABLE' }),
        expect.objectContaining({ sku: 'BLING-E2E-002', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' }),
      ]),
    );
  });

  // ─── INV-T-090b: WooCommerce provider sync ────────────────────────────────

  it('INV-T-090b: sync via WooCommerce provider persiste itens com preço e sku corretos', async () => {
    const wooProduct = { id: 9001, sku: 'WOO-E2E-001', name: 'Produto WC E2E', stock_quantity: 8, price: '35.00', regular_price: '35.00' };

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [wooProduct],
        headers: { get: (n: string) => n === 'X-WP-TotalPages' ? '1' : null },
      }) as unknown as typeof fetch;

    const connRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({
        sourceType: 'WOOCOMMERCE',
        providerName: 'WooCommerce',
        config: { storeUrl: 'https://loja-e2e.com', consumerKey: 'ck_test', consumerSecret: 'cs_test' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections/${connRes.body.id}/sync`)
      .set('Cookie', [authCookie])
      .expect(202);

    const itemsRes = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=WOO-E2E-001`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(itemsRes.body).toHaveLength(1);
    expect(itemsRes.body[0]).toMatchObject({
      sku: 'WOO-E2E-001',
      availableQuantity: 8,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '35.00',
    });
  });

  // ─── INV-T-091: tenant isolation ─────────────────────────────────────────

  it('INV-T-091a: itens sincronizados de um tenant não aparecem para outro tenant', async () => {
    const tenant2Email = `iso-tenant-${Date.now()}@test.com`;
    const tenant2Cnpj = `it${Date.now()}`;

    const tenant2 = await prisma.tenant.create({
      data: { companyName: 'Isolated Store', cnpj: tenant2Cnpj, plan: 'ESSENCIAL' },
    });
    const tenant2Id = tenant2.id;

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { tenantId: tenant2Id, name: 'Isolated Owner', email: tenant2Email, phone: '11970000099', passwordHash, role: 'OWNER' },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: tenant2Email, password })
      .expect(200);
    const tenant2Cookie = loginRes.get('Set-Cookie')![0];

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({ sku: 'ISO-SKU-001', name: 'Item Isolado', availableQuantity: 10, availabilityStatus: 'AVAILABLE', source: 'MANUAL_SNAPSHOT' })
      .expect(201);

    const tenant2Items = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenant2Id}/inventory/items?query=ISO-SKU-001`)
      .set('Cookie', [tenant2Cookie])
      .expect(200);

    expect(tenant2Items.body).toHaveLength(0);

    await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenant2Id}::uuid`).catch(() => { });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant2Id } }).catch(() => { });
    await prisma.user.deleteMany({ where: { tenantId: tenant2Id } }).catch(() => { });
    await prisma.tenant.deleteMany({ where: { id: tenant2Id } }).catch(() => { });
  });

  // ─── INV-T-091b: auth guard prevents cross-tenant access ─────────────────

  it('INV-T-091b: tenant A não pode acessar itens de tenant B via API', async () => {
    const fakeTenantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${fakeTenantId}/inventory/items`)
      .set('Cookie', [authCookie])
      .expect(403);
  });
});
