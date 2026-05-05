import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import * as request from 'supertest';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';
import { ConfigureShippingPolicyUseCase } from '@modules/commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import { StartShoppingSessionUseCase } from '@modules/commerce/application/use-cases/StartShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '@modules/commerce/application/use-cases/AddItemToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from '@modules/commerce/application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from '@modules/commerce/application/use-cases/CheckoutShoppingSessionUseCase';
import { CreateTenantBranchUseCase } from '../application/use-cases/CreateTenantBranchUseCase';

describe('Active branch scope (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let authCookies: string[];

  const ownerEmail = `branch-scope-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';

  const paymentGatewayMock: jest.Mocked<IPaymentGateway> = {
    createCustomer: jest.fn(),
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
      url: `https://pay.test/${data.externalReference || 'branch-scope'}`,
    })),
    removePaymentLink: jest.fn(),
    restorePaymentLink: jest.fn(),
    parseWebhook: jest.fn(),
    getCustomer: jest.fn(),
  };

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

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!;
  }

  async function createBranch(name: string) {
    const createTenantBranch = app.get(CreateTenantBranchUseCase);
    const response = await createTenantBranch.execute({
      tenantId,
      name,
      active: true,
    });

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name,
        }),
      }),
    );

    return response.data as { id: string; name: string };
  }

  async function createContact(input: {
    name: string;
    phone: string;
    document: string;
    branchId?: string;
  }) {
    const req = request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', authCookies);

    if (input.branchId) {
      req.query({ branchId: input.branchId });
    }

    const response = await req
      .send({
        name: input.name,
        phone: input.phone,
        document: input.document,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: input.name,
      }),
    );

    return response.body as { id: string; name: string; phone: string };
  }

  async function openConversation(contactId: string) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/open-by-contact`)
      .set('Cookie', authCookies)
      .send({
        contactId,
        channel: 'WHATSAPP',
      })
      .expect(201);

    return response.body as { conversationId: string };
  }

  async function createRecoveryCase(input: {
    debtorName?: string;
    phone?: string;
    contactId?: string;
    branchId?: string;
    chargeTitle: string;
    amountDue: string;
  }) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', authCookies)
      .send({
        branchId: input.branchId,
        contactId: input.contactId,
        debtorName: input.debtorName,
        phone: input.phone,
        chargeType: 'ORDER',
        chargeTitle: input.chargeTitle,
        chargeDescription: `cobrança ${input.chargeTitle}`,
        relatedEntityType: 'ORDER',
        relatedEntityId: crypto.randomUUID(),
        relatedEntityLabel: input.chargeTitle,
        amountDue: input.amountDue,
        dueDate: '2030-07-15',
      })
      .expect(201);

    return response.body as { id: string; debtorName: string };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IPAYMENT_GATEWAY)
      .useValue(paymentGatewayMock)
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

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'Tenant Multiunidade Teste',
      cnpj: makeValidCnpj(
        Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12)),
      ),
      ownerName: 'Owner Multiunidade',
      ownerEmail,
      ownerPhone: '11988887777',
      ownerPassword: password,
      plan: 'ESSENCIAL',
      businessType: 'MARKET',
    });

    tenantId = tenant.id;
    authCookies = await login();
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM recovery_schema.recovery_cases WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM commerce_schema.orders WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM commerce_schema.shipping_policies WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM messaging_schema.messages WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM messaging_schema.conversations WHERE tenant_id = ${tenantId}::uuid
      `).catch(() => { });
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.inventoryItem.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.catalogItem.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.catalogCategory.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should scope conversations, checkout orders and recovery cases strictly by branch', async () => {
    const branchA = await createBranch('Loja Centro');
    const branchB = await createBranch('Loja Norte');

    const globalContact = await createContact({
      name: 'Cliente Global Scope',
      phone: '5511999000101',
      document: '11111111111',
    });
    const branchAContact = await createContact({
      name: 'Cliente Filial A Scope',
      phone: '5511999000102',
      document: '22222222222',
      branchId: branchA.id,
    });
    const branchBContact = await createContact({
      name: 'Cliente Filial B Scope',
      phone: '5511999000103',
      document: '33333333333',
      branchId: branchB.id,
    });

    const globalConversation = await openConversation(globalContact.id);
    const branchAConversation = await openConversation(branchAContact.id);
    const branchBConversation = await openConversation(branchBContact.id);

    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const syncInventory = app.get(SyncInventoryItemUseCase);
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);
    const startShoppingSession = app.get(StartShoppingSessionUseCase);
    const addItemToShoppingSession = app.get(AddItemToShoppingSessionUseCase);
    const updateShoppingSessionFulfillment = app.get(
      UpdateShoppingSessionFulfillmentUseCase,
    );
    const checkoutShoppingSession = app.get(CheckoutShoppingSessionUseCase);

    const category = await createCategory.execute({
      tenantId,
      name: 'Mercearia Scope',
    });
    const catalogItem = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe Scope',
      basePrice: '15.00',
      tags: ['cafe'],
    });
    const inventoryItem = await syncInventory.execute({
      tenantId,
      catalogItemId: catalogItem.id,
      sku: `SCOPE-${Date.now()}`,
      name: 'Cafe Scope',
      availableQuantity: 100,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '15.00',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 6,
      notes: 'Frete fixo multiunidade',
    });

    const createOrder = async (input: {
      branchId?: string;
      conversationId: string;
      contactId: string;
    }) => {
      const session = await startShoppingSession.execute({
        tenantId,
        branchId: input.branchId ?? null,
        conversationId: input.conversationId,
        contactId: input.contactId,
      });

      await addItemToShoppingSession.execute({
        tenantId,
        sessionId: session.id,
        inventoryItemId: inventoryItem.id,
        quantity: 2,
      });

      await updateShoppingSessionFulfillment.execute({
        tenantId,
        sessionId: session.id,
        fulfillmentType: 'DELIVERY',
        deliveryAddress: 'Rua de teste, 100',
      });

      return checkoutShoppingSession.execute({
        tenantId,
        sessionId: session.id,
        billingType: 'PIX',
        paymentLinkName: 'Pedido scope',
      });
    };

    await createOrder({
      conversationId: globalConversation.conversationId,
      contactId: globalContact.id,
    });
    await createOrder({
      branchId: branchA.id,
      conversationId: branchAConversation.conversationId,
      contactId: branchAContact.id,
    });
    await createOrder({
      branchId: branchB.id,
      conversationId: branchBConversation.conversationId,
      contactId: branchBContact.id,
    });

    await createRecoveryCase({
      debtorName: 'Devedor Global Scope',
      phone: '5511999000201',
      chargeTitle: 'Pedido Global',
      amountDue: '45.00',
    });
    await createRecoveryCase({
      contactId: branchAContact.id,
      branchId: branchA.id,
      chargeTitle: 'Pedido Filial A',
      amountDue: '55.00',
    });
    await createRecoveryCase({
      contactId: branchBContact.id,
      branchId: branchB.id,
      chargeTitle: 'Pedido Filial B',
      amountDue: '65.00',
    });

    const conversationsAResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/conversations`)
      .set('Cookie', authCookies)
      .query({ branchId: branchA.id, page: 1, limit: 50 })
      .expect(200);

    const conversationNamesA = conversationsAResponse.body.data.map(
      (conversation: { contactName: string }) => conversation.contactName,
    );
    expect(conversationNamesA).toEqual(
      expect.arrayContaining(['Cliente Filial A Scope']),
    );
    expect(conversationNamesA).not.toContain('Cliente Global Scope');
    expect(conversationNamesA).not.toContain('Cliente Filial B Scope');

    const conversationsBResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/conversations`)
      .set('Cookie', authCookies)
      .query({ branchId: branchB.id, page: 1, limit: 50 })
      .expect(200);

    const conversationNamesB = conversationsBResponse.body.data.map(
      (conversation: { contactName: string }) => conversation.contactName,
    );
    expect(conversationNamesB).toEqual(
      expect.arrayContaining(['Cliente Filial B Scope']),
    );
    expect(conversationNamesB).not.toContain('Cliente Global Scope');
    expect(conversationNamesB).not.toContain('Cliente Filial A Scope');

    const ordersAResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/commerce/orders`)
      .set('Cookie', authCookies)
      .query({ branchId: branchA.id })
      .expect(200);

    const orderNamesA = ordersAResponse.body.map(
      (order: { contactName: string }) => order.contactName,
    );
    expect(orderNamesA).toEqual(
      expect.arrayContaining(['Cliente Filial A Scope']),
    );
    expect(orderNamesA).not.toContain('Cliente Global Scope');
    expect(orderNamesA).not.toContain('Cliente Filial B Scope');

    const ordersBResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/commerce/orders`)
      .set('Cookie', authCookies)
      .query({ branchId: branchB.id })
      .expect(200);

    const orderNamesB = ordersBResponse.body.map(
      (order: { contactName: string }) => order.contactName,
    );
    expect(orderNamesB).toEqual(
      expect.arrayContaining(['Cliente Filial B Scope']),
    );
    expect(orderNamesB).not.toContain('Cliente Global Scope');
    expect(orderNamesB).not.toContain('Cliente Filial A Scope');

    const recoveryAResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', authCookies)
      .query({ branchId: branchA.id })
      .expect(200);

    const recoveryNamesA = recoveryAResponse.body.map(
      (recoveryCase: { debtorName: string }) => recoveryCase.debtorName,
    );
    expect(recoveryNamesA).toEqual(
      expect.arrayContaining(['Cliente Filial A Scope']),
    );
    expect(recoveryNamesA).not.toContain('Devedor Global Scope');
    expect(recoveryNamesA).not.toContain('Cliente Filial B Scope');

    const recoveryBResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/recovery/cases`)
      .set('Cookie', authCookies)
      .query({ branchId: branchB.id })
      .expect(200);

    const recoveryNamesB = recoveryBResponse.body.map(
      (recoveryCase: { debtorName: string }) => recoveryCase.debtorName,
    );
    expect(recoveryNamesB).toEqual(
      expect.arrayContaining(['Cliente Filial B Scope']),
    );
    expect(recoveryNamesB).not.toContain('Devedor Global Scope');
    expect(recoveryNamesB).not.toContain('Cliente Filial A Scope');
  });
});
