import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { InventoryAsyncJobStatus } from '../application/services/InventoryAsyncJobsService';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('InventoryProviderSync (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let queue: Queue;
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

  async function createConnection(sourceType: string, providerName: string, config: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({ sourceType, providerName, config })
      .expect(201);
    return res.body;
  }

  async function triggerSync(connectionId: string): Promise<{ jobId: string }> {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections/${connectionId}/sync`)
      .set('Cookie', [authCookie])
      .expect(202);
    return { jobId: res.body.id };
  }

  async function waitForJobCompletion(jobId: string): Promise<{ status: InventoryAsyncJobStatus }> {
    for (let attempt = 0; attempt < 30; attempt++) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/inventory/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = res.body.status as InventoryAsyncJobStatus;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return res.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for inventory sync job ${jobId}`);
  }

  async function listItems(query?: string) {
    const url = query
      ? `/api/v1/tenants/${tenantId}/inventory/items?query=${query}`
      : `/api/v1/tenants/${tenantId}/inventory/items`;
    const res = await request(app.getHttpServer()).get(url).set('Cookie', [authCookie]).expect(200);
    return res.body;
  }

  async function listConnections() {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .expect(200);
    return res.body;
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
    queue = app.get<Queue>(getQueueToken('inventory-async-jobs'));

    await queue.obliterate({ force: true }).catch(() => { });

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

  afterEach(async () => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    await queue.drain(true).catch(() => { });
    await queue.clean(0, 100, 'delayed').catch(() => { });
    await queue.clean(0, 100, 'failed').catch(() => { });
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_async_jobs WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }
    if (app) await app.close();
  });

  // ─── INV-T-090a: Bling ────────────────────────────────────────────────────

  it('INV-T-090a: sync via Bling persiste itens no banco com sku, qty e status corretos', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 501, codigo: 'BLING-E2E-001', nome: 'Produto Bling E2E', estoque: { saldoVirtual: 15 }, preço: 49.9 },
        { id: 502, codigo: 'BLING-E2E-002', nome: 'Produto Zerado', estoque: { saldoVirtual: 0 }, preço: 29.9 },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) as unknown as typeof fetch;

    const conn = await createConnection('BLING', 'Bling', { accessToken: 'e2e-bling-tok' });
    const { jobId } = await triggerSync(conn.id);
    await waitForJobCompletion(jobId);

    const items = await listItems();
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ sku: 'BLING-E2E-001', availableQuantity: 15, availabilityStatus: 'AVAILABLE' }),
      expect.objectContaining({ sku: 'BLING-E2E-002', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' }),
    ]));
  });

  // ─── INV-T-090b: WooCommerce ──────────────────────────────────────────────

  it('INV-T-090b: sync via WooCommerce persiste itens com preço correto', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 9001, type: 'simple', sku: 'WOO-E2E-001', name: 'Produto WC E2E', stock_quantity: 8, price: '35.00' }],
        headers: { get: (n: string) => n === 'X-WP-TotalPages' ? '1' : null },
      }) as unknown as typeof fetch;

    const conn = await createConnection('WOOCOMMERCE', 'WooCommerce', {
      storeUrl: 'https://loja-e2e.com', consumerKey: 'ck_test', consumerSecret: 'cs_test',
    });
    const { jobId } = await triggerSync(conn.id);
    await waitForJobCompletion(jobId);

    const items = await listItems('WOO-E2E-001');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sku: 'WOO-E2E-001', availableQuantity: 8, currentPrice: '35.00' });
  });

  // ─── INV-T-090c: Nuvemshop ───────────────────────────────────────────────

  it('INV-T-090c: sync via Nuvemshop persiste variantes com sku correto', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 12345 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{
        id: 1,
        name: { pt: 'Camiseta NS E2E' },
        variants: [{ id: 11, sku: 'NS-E2E-001', stock: 20, price: '49.90', values: ['P'] }],
      }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) as unknown as typeof fetch;

    const conn = await createConnection('NUVEMSHOP', 'Nuvemshop', {
      storeId: '12345', accessToken: 'ns-e2e-tok',
    });
    const { jobId } = await triggerSync(conn.id);
    await waitForJobCompletion(jobId);

    const items = await listItems('NS-E2E-001');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sku: 'NS-E2E-001', availableQuantity: 20 });
  });

  // ─── INV-T-090d: MercadoLivre (two-step fetch) ───────────────────────────

  it('INV-T-090d: sync via MercadoLivre com two-step fetch persiste itens no banco', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'USER123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        results: ['MLB111', 'MLB222'],
        paging: { total: 2, offset: 0, limit: 50 },
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([
        { code: 200, body: { id: 'MLB111', title: 'Produto ML E2E', available_quantity: 5, price: 99.9, currency_id: 'BRL', seller_custom_field: 'ML-E2E-001' } },
        { code: 200, body: { id: 'MLB222', title: 'Produto ML E2E 2', available_quantity: 0, price: 49.9, currency_id: 'BRL', seller_custom_field: 'ML-E2E-002' } },
      ]) }) as unknown as typeof fetch;

    const conn = await createConnection('MERCADOLIVRE', 'MercadoLivre', {
      userId: 'USER123', accessToken: 'ml-e2e-tok',
    });
    const { jobId } = await triggerSync(conn.id);
    await waitForJobCompletion(jobId);

    const items = await listItems('ML-E2E-001');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sku: 'ML-E2E-001', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
  });

  // ─── INV-T-090e: lastSyncedAt atualizado ─────────────────────────────────

  it('INV-T-090e: após sync bem-sucedido a conexão tem lastSyncedAt não nulo', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) as unknown as typeof fetch;

    const conn = await createConnection('BLING', 'Bling LastSync', { accessToken: 'e2e-tok-lastsync' });

    const connsBefore = await listConnections();
    const beforeSync = connsBefore.find((c: any) => c.id === conn.id);
    expect(beforeSync.lastSyncedAt).toBeNull();

    const { jobId } = await triggerSync(conn.id);
    const job = await waitForJobCompletion(jobId);
    expect(job.status).toBe('COMPLETED');

    const connsAfter = await listConnections();
    const afterSync = connsAfter.find((c: any) => c.id === conn.id);
    expect(afterSync.lastSyncedAt).not.toBeNull();
  });

  // ─── INV-T-090f: erro do provider → job FAILED, lastSyncedAt nulo ─────────

  it('INV-T-090f: erro HTTP 500 do provider marca job como FAILED e lastSyncedAt não é atualizado', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' }) as unknown as typeof fetch;

    const conn = await createConnection('BLING', 'Bling Error Test', { accessToken: 'e2e-tok-err' });
    const { jobId } = await triggerSync(conn.id);
    const job = await waitForJobCompletion(jobId);

    expect(job.status).toBe('FAILED');

    const conns = await listConnections();
    const target = conns.find((c: any) => c.id === conn.id);
    expect(target.lastSyncedAt).toBeNull();
  });

  // ─── INV-T-090g: SKU vazio ignorado ──────────────────────────────────────

  it('INV-T-090g: item com SKU vazio é ignorado e demais itens são persistidos', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 801, codigo: '', nome: 'Sem SKU', estoque: { saldoVirtual: 1 }, preço: 10 },
        { id: 802, codigo: 'VALID-SKU-001', nome: 'Válido', estoque: { saldoVirtual: 3 }, preço: 20 },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) as unknown as typeof fetch;

    const conn = await createConnection('BLING', 'Bling Partial', { accessToken: 'e2e-tok-partial' });
    const { jobId } = await triggerSync(conn.id);
    await waitForJobCompletion(jobId);

    const items = await listItems('VALID-SKU-001');
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe('VALID-SKU-001');
  });
});
