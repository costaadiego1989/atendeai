import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

describe('InventoryEventBus (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: IEventBus;
  let tenantId: string;
  let authCookie: string;
  let publishedEvents: IntegrationEvent[];

  const ownerEmail = `event-bus-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `eb${Date.now()}`;
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
    eventBus = app.get<IEventBus>(EVENT_BUS);

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const tenant = await prisma.tenant.create({
      data: { companyName: 'Event Bus Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { tenantId, name: 'Event Bus Owner', email: ownerEmail, phone: '11970000080', passwordHash, role: 'OWNER' },
    });

    authCookie = await login();
  });

  beforeEach(() => {
    publishedEvents = [];
    jest.spyOn(eventBus, 'publish').mockImplementation(async (event: IntegrationEvent) => {
      publishedEvents.push(event);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_items WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`DELETE FROM inventory_schema.inventory_connections WHERE tenant_id = ${tenantId}::uuid`).catch(() => { });
      await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }
    if (app) await app.close();
  });

  // ─── INV-T-092a: synced event ─────────────────────────────────────────────

  it('INV-T-092a: POST /items/sync publica inventory.item.synced.v1 com sku e tenantId corretos', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'EVT-001',
        name: 'Produto Evento',
        availableQuantity: 10,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '25.00',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    const syncedEvents = publishedEvents.filter((e) => e.eventName === 'inventory.item.synced.v1');
    expect(syncedEvents).toHaveLength(1);
    expect(syncedEvents[0].payload).toMatchObject({
      tenantId,
      sku: 'EVT-001',
      availableQuantity: 10,
      availabilityStatus: 'AVAILABLE',
    });
  });

  // ─── INV-T-092b: unavailable event ───────────────────────────────────────

  it('INV-T-092b: POST /items/sync com qty=0 publica inventory.item.unavailable.v1', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'EVT-ZERO-001',
        name: 'Sem Estoque Evento',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    expect(publishedEvents.filter((e) => e.eventName === 'inventory.item.synced.v1')).toHaveLength(1);
    expect(publishedEvents.filter((e) => e.eventName === 'inventory.item.unavailable.v1')).toHaveLength(1);

    const unavailableEvent = publishedEvents.find((e) => e.eventName === 'inventory.item.unavailable.v1');
    expect(unavailableEvent!.payload).toMatchObject({ tenantId, sku: 'EVT-ZERO-001' });
  });

  // ─── INV-T-092c: connection created event ────────────────────────────────

  it('INV-T-092c: POST /connections publica inventory.connection.created.v1 com connectionId e tenantId', async () => {
    const connRes = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/connections`)
      .set('Cookie', [authCookie])
      .send({ sourceType: 'MANUAL_SNAPSHOT', providerName: 'Evento Manual', config: {} })
      .expect(201);

    const connEvents = publishedEvents.filter((e) => e.eventName === 'inventory.connection.created.v1');
    expect(connEvents).toHaveLength(1);
    expect(connEvents[0].payload).toMatchObject({
      connectionId: connRes.body.id,
      tenantId,
      sourceType: 'MANUAL_SNAPSHOT',
      providerName: 'Evento Manual',
    });
  });

  // ─── INV-T-092d: price changed event ─────────────────────────────────────

  it('INV-T-092d: segundo sync com preço diferente publica inventory.price.changed.v1', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'EVT-PRICE-001',
        name: 'Produto Preço',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '100.00',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    publishedEvents.length = 0;

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/inventory/items/sync`)
      .set('Cookie', [authCookie])
      .send({
        sku: 'EVT-PRICE-001',
        name: 'Produto Preço',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '150.00',
        source: 'MANUAL_SNAPSHOT',
      })
      .expect(201);

    const priceEvents = publishedEvents.filter((e) => e.eventName === 'inventory.price.changed.v1');
    expect(priceEvents).toHaveLength(1);
    expect(priceEvents[0].payload).toMatchObject({
      sku: 'EVT-PRICE-001',
      previousPrice: '100.00',
      newPrice: '150.00',
    });
  });
});
