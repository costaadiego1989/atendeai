import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { CreateCatalogCategoryUseCase } from '@modules/catalog/application/use-cases/CreateCatalogCategoryUseCase';
import { CreateCatalogItemUseCase } from '@modules/catalog/application/use-cases/CreateCatalogItemUseCase';
import { SyncInventoryItemUseCase } from '@modules/inventory/application/use-cases/SyncInventoryItemUseCase';
import { ConfigureShippingPolicyUseCase } from '../application/use-cases/ConfigureShippingPolicyUseCase';
import { SearchCommerceCatalogUseCase } from '../application/use-cases/SearchCommerceCatalogUseCase';
import { StartShoppingSessionUseCase } from '../application/use-cases/StartShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '../application/use-cases/AddItemToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from '../application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from '../application/use-cases/CheckoutShoppingSessionUseCase';
import { AdvanceCommerceConversationUseCase } from '../application/use-cases/AdvanceCommerceConversationUseCase';
import { ListCommerceOrdersUseCase } from '../application/use-cases/ListCommerceOrdersUseCase';
import { GetCommerceOrderDetailsUseCase } from '../application/use-cases/GetCommerceOrderDetailsUseCase';
import { UpdateCommerceOrderStatusUseCase } from '../application/use-cases/UpdateCommerceOrderStatusUseCase';
import { DetectAbandonedShoppingSessionsUseCase } from '../application/use-cases/DetectAbandonedShoppingSessionsUseCase';
import { UpdateCommerceAbandonmentStateUseCase } from '../application/use-cases/UpdateCommerceAbandonmentStateUseCase';
import { TriggerCommerceAbandonmentTouchUseCase } from '../application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../domain/ports/ICommerceRepository';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  CommerceCheckoutCreatedIntegrationEvent,
  CommerceSessionItemAddedIntegrationEvent,
  CommerceSessionStartedIntegrationEvent,
} from '../application/integration-events/CheckoutIntegrationEvents';

describe('CommerceModule (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let commerceRepository: ICommerceRepository;
  let tenantId: string;
  const ownerEmail = `commerce-owner-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`;

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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    commerceRepository = app.get<ICommerceRepository>(COMMERCE_REPOSITORY);

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'Comercio Teste',
      cnpj: makeValidCnpj(
        Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12)),
      ),
      ownerName: 'Owner Commerce',
      ownerEmail,
      ownerPhone: '11988887777',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
      businessType: 'MARKET',
    });

    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM commerce_schema.orders WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM commerce_schema.shopping_session_items WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM commerce_schema.shopping_sessions WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM commerce_schema.shipping_policies WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.inventoryItem
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.catalogItem
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.catalogCategory
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should manage a commerce flow with freight and mark the order as paid after payment confirmation', async () => {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const syncInventory = app.get(SyncInventoryItemUseCase);
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);
    const searchCommerceCatalog = app.get(SearchCommerceCatalogUseCase);
    const startShoppingSession = app.get(StartShoppingSessionUseCase);
    const addItemToShoppingSession = app.get(AddItemToShoppingSessionUseCase);
    const updateShoppingSessionFulfillment = app.get(
      UpdateShoppingSessionFulfillmentUseCase,
    );
    const checkoutShoppingSession = app.get(CheckoutShoppingSessionUseCase);
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    const eventBus = app.get<IEventBus>(EVENT_BUS);
    const originalPublish = eventBus.publish.bind(eventBus);
    const publishedEvents: unknown[] = [];
    const publishSpy = jest
      .spyOn(eventBus, 'publish')
      .mockImplementation(async (event) => {
        publishedEvents.push(event);
        return originalPublish(event);
      });

    try {
      const category = await createCategory.execute({
        tenantId,
        name: 'Cafe da manha',
      });

      const catalogItem = await createItem.execute({
        tenantId,
        categoryId: category.id,
        type: 'PRODUCT',
        name: 'Pao frances',
        basePrice: '1.50',
        tags: ['pao', 'padaria'],
      });

      const inventoryItem = await syncInventory.execute({
        tenantId,
        catalogItemId: catalogItem.id,
        sku: 'PAO-001',
        name: 'Pao frances',
        availableQuantity: 50,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '1.50',
        source: 'MANUAL_SNAPSHOT',
      });

      await configureShippingPolicy.execute({
        tenantId,
        mode: 'FIXED',
        fixedAmount: 8,
        notes: 'Entrega urbana fixa',
      });

      const options = await searchCommerceCatalog.execute({
        tenantId,
        query: 'pao',
      });

      expect(options.length).toBeGreaterThan(0);
      expect(options[0]?.name.toLowerCase()).toContain('pao');

      const session = await startShoppingSession.execute({
        tenantId,
        conversationId: crypto.randomUUID(),
      });

      const updatedSession = await addItemToShoppingSession.execute({
        tenantId,
        sessionId: session.id,
        inventoryItemId: inventoryItem.id,
        quantity: 4,
      });

      expect(updatedSession.subtotalAmount).toBe(6);

      const readySession = await updateShoppingSessionFulfillment.execute({
        tenantId,
        sessionId: session.id,
        fulfillmentType: 'DELIVERY',
        deliveryAddress: 'Rua das Flores, 100 - Copacabana',
      });

      expect(readySession.freightAmount).toBe(8);
      expect(readySession.totalAmount).toBe(14);

      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
        id: 'plink-commerce-1',
        url: 'https://pay.test/plink-commerce-1',
      });

      const checkout = await checkoutShoppingSession.execute({
        tenantId,
        sessionId: session.id,
        billingType: 'PIX',
        paymentLinkName: 'Pedido padaria',
      });

      expect(checkout.order.status).toBe('AWAITING_PAYMENT');
      expect(checkout.order.totalAmount).toBe(14);
      expect(checkout.paymentLink.url).toContain('pay.test');

      await eventBus.publish(
        new PaymentConfirmedIntegrationEvent({
          tenantId,
          paymentId: 'pay-commerce-1',
          amount: 14,
          rawReference: checkout.order.paymentReference ?? undefined,
          confirmedAt: new Date(),
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const paidOrder = await commerceRepository.findOrderByPaymentReference(
        tenantId,
        checkout.order.paymentReference!,
      );
      const paidSession = await commerceRepository.findSessionById(
        tenantId,
        session.id,
      );

      expect(paidOrder?.status).toBe('PAID');
      expect(paidOrder?.paymentStatus).toBe('PAID');
      expect(paidSession?.status).toBe('PAID');
      expect(paidSession?.paymentStatus).toBe('PAID');

      const sessionStartedEvent = publishedEvents.find(
        (event) =>
          event instanceof CommerceSessionStartedIntegrationEvent ||
          (typeof event === 'object' &&
            event != null &&
            'queue' in event &&
            event.queue === 'commerce.session.started'),
      ) as CommerceSessionStartedIntegrationEvent | undefined;
      const itemAddedEvent = publishedEvents.find(
        (event) =>
          event instanceof CommerceSessionItemAddedIntegrationEvent ||
          (typeof event === 'object' &&
            event != null &&
            'queue' in event &&
            event.queue === 'commerce.session.item-added'),
      ) as CommerceSessionItemAddedIntegrationEvent | undefined;
      const checkoutCreatedEvent = publishedEvents.find(
        (event) =>
          event instanceof CommerceCheckoutCreatedIntegrationEvent ||
          (typeof event === 'object' &&
            event != null &&
            'queue' in event &&
            event.queue === 'commerce.checkout.created'),
      ) as CommerceCheckoutCreatedIntegrationEvent | undefined;
      expect(sessionStartedEvent?.payload).toMatchObject({
        sessionId: session.id,
        tenantId,
        conversationId: session.conversationId,
      });
      expect(itemAddedEvent?.payload).toMatchObject({
        tenantId,
        sessionId: session.id,
        itemName: 'Pao frances',
        quantity: 4,
        subtotalAmount: 6,
        totalAmount: 6,
      });
      expect(checkoutCreatedEvent?.payload).toMatchObject({
        orderId: checkout.order.id,
        tenantId,
        sessionId: session.id,
        totalAmount: 14,
        freightAmount: 8,
      });
    } finally {
      publishSpy.mockRestore();
    }
  });

  it('should persist shipping policy with radius and delivery schedule', async () => {
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);

    const policy = await configureShippingPolicy.execute({
      tenantId,
      mode: 'PER_KM',
      pricePerKm: 4.2,
      minimumAmount: 15,
      maxRadiusKm: 9,
      deliverySchedule: [
        {
          weekday: 'MONDAY',
          enabled: true,
          startTime: '09:00',
          endTime: '18:00',
        },
        {
          weekday: 'SATURDAY',
          enabled: true,
          startTime: '09:00',
          endTime: '13:00',
        },
      ],
      notes: 'Validar manualmente bairros fora da zona sul.',
    });

    expect(policy.mode).toBe('PER_KM');
    expect(policy.pricePerKm).toBe(4.2);
    expect(policy.minimumAmount).toBe(15);
    expect(policy.maxRadiusKm).toBe(9);
    expect(policy.servicedNeighborhoods).toEqual([]);
    expect(policy.deliverySchedule).toEqual([
      {
        weekday: 'MONDAY',
        enabled: true,
        startTime: '09:00',
        endTime: '18:00',
      },
      {
        weekday: 'SATURDAY',
        enabled: true,
        startTime: '09:00',
        endTime: '13:00',
      },
    ]);
    expect(policy.notes).toBe('Validar manualmente bairros fora da zona sul.');

    const persisted =
      await commerceRepository.findShippingPolicyByTenantId(tenantId);

    expect(persisted?.mode).toBe('PER_KM');
    expect(persisted?.pricePerKm).toBe(4.2);
    expect(persisted?.minimumAmount).toBe(15);
    expect(persisted?.maxRadiusKm).toBe(9);
    expect(persisted?.servicedNeighborhoods).toEqual([]);
    expect(persisted?.deliverySchedule).toEqual([
      {
        weekday: 'MONDAY',
        enabled: true,
        startTime: '09:00',
        endTime: '18:00',
      },
      {
        weekday: 'SATURDAY',
        enabled: true,
        startTime: '09:00',
        endTime: '13:00',
      },
    ]);
  });

  it('should calculate per-km freight with minimum amount and support multi-item cart before checkout', async () => {
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
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);

    const category = await createCategory.execute({
      tenantId,
      name: 'Mercearia',
    });

    const arroz = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Arroz integral 1kg',
      basePrice: '12.90',
      tags: ['arroz', 'integral'],
    });

    const leite = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Leite zero lactose',
      basePrice: '8.50',
      tags: ['leite', 'lactose'],
    });

    const arrozInventory = await syncInventory.execute({
      tenantId,
      catalogItemId: arroz.id,
      sku: 'ARROZ-001',
      name: 'Arroz integral 1kg',
      availableQuantity: 20,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '12.90',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'PER_KM',
      pricePerKm: 3.5,
      minimumAmount: 12,
      notes: 'Entrega urbana por quilometro',
    });

    const session = await startShoppingSession.execute({
      tenantId,
      conversationId: crypto.randomUUID(),
    });

    await addItemToShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      inventoryItemId: arrozInventory.id,
      quantity: 2,
    });

    const updatedSession = await addItemToShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      catalogItemId: leite.id,
      quantity: 1,
    });

    expect(updatedSession.items).toHaveLength(2);
    expect(updatedSession.subtotalAmount).toBe(34.3);

    const readySession = await updateShoppingSessionFulfillment.execute({
      tenantId,
      sessionId: session.id,
      fulfillmentType: 'DELIVERY',
      distanceKm: 2,
      deliveryAddress: 'Avenida Atlantica, 500 - Copacabana',
    });

    expect(readySession.shippingMode).toBe('PER_KM');
    expect(readySession.freightAmount).toBe(12);
    expect(readySession.totalAmount).toBe(46.3);

    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-commerce-2',
      url: 'https://pay.test/plink-commerce-2',
    });

    const checkout = await checkoutShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      billingType: 'PIX',
      paymentLinkName: 'Pedido mercearia',
    });

    expect(checkout.order.shippingMode).toBe('PER_KM');
    expect(checkout.order.subtotalAmount).toBe(34.3);
    expect(checkout.order.freightAmount).toBe(12);
    expect(checkout.order.totalAmount).toBe(46.3);
    expect(checkout.paymentLink.url).toContain('pay.test/plink-commerce-2');
  });

  it('should list checkout orders with contact context and open detailed order data', async () => {
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
    const listCommerceOrders = app.get(ListCommerceOrdersUseCase);
    const getCommerceOrderDetails = app.get(GetCommerceOrderDetailsUseCase);
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Checkout',
        phone: '21993001883',
        stage: 'CUSTOMER',
      },
    });

    const category = await createCategory.execute({
      tenantId,
      name: 'Padaria',
    });

    const catalogItem = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Bolo de cenoura',
      basePrice: '18.00',
      tags: ['bolo', 'padaria'],
    });

    const inventoryItem = await syncInventory.execute({
      tenantId,
      catalogItemId: catalogItem.id,
      sku: 'BOLO-001',
      name: 'Bolo de cenoura',
      availableQuantity: 10,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '18.00',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 6,
      notes: 'Entrega local',
    });

    const session = await startShoppingSession.execute({
      tenantId,
      conversationId: crypto.randomUUID(),
      contactId: contact.id,
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
      deliveryAddress: 'Rua da Padaria, 12 - Centro',
    });

    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-commerce-3',
      url: 'https://pay.test/plink-commerce-3',
    });

    const checkout = await checkoutShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      billingType: 'PIX',
      paymentLinkName: 'Pedido bolo de cenoura',
    });

    const orders = await listCommerceOrders.execute({ tenantId });
    const listedOrder = orders.find((order) => order.id === checkout.order.id);

    expect(listedOrder).toBeDefined();
    expect(listedOrder?.contactName).toBe('Cliente Checkout');
    expect(listedOrder?.contactPhone).toBe('21993001883');
    expect(listedOrder?.totalAmount).toBe(42);
    expect(listedOrder?.paymentStatus).toBe('PENDING');

    const details = await getCommerceOrderDetails.execute(
      tenantId,
      checkout.order.id,
    );

    expect(details.order.id).toBe(checkout.order.id);
    expect(details.order.paymentLinkUrl).toBe(
      'https://pay.test/plink-commerce-3',
    );
    expect(details.session?.id).toBe(session.id);
    expect(details.session?.items).toHaveLength(1);
    expect(details.session?.items[0]?.name).toBe('Bolo de cenoura');
    expect(details.session?.deliveryAddress).toBe(
      'Rua da Padaria, 12 - Centro',
    );
  });

  it('should update an operational commerce order status after payment', async () => {
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
    const updateCommerceOrderStatus = app.get(UpdateCommerceOrderStatusUseCase);
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    const eventBus = app.get<IEventBus>(EVENT_BUS);

    const category = await createCategory.execute({
      tenantId,
      name: 'Entrega operacional',
    });

    const catalogItem = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Kit cafe da tarde',
      basePrice: '25.00',
      tags: ['kit', 'cafe'],
    });

    const inventoryItem = await syncInventory.execute({
      tenantId,
      catalogItemId: catalogItem.id,
      sku: `KIT-${String(Date.now()).slice(-4)}`,
      name: 'Kit cafe da tarde',
      availableQuantity: 8,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '25.00',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 10,
      notes: 'Entrega operacional fixa',
    });

    const session = await startShoppingSession.execute({
      tenantId,
      conversationId: crypto.randomUUID(),
    });

    await addItemToShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      inventoryItemId: inventoryItem.id,
      quantity: 1,
    });

    await updateShoppingSessionFulfillment.execute({
      tenantId,
      sessionId: session.id,
      fulfillmentType: 'DELIVERY',
      deliveryAddress: 'Rua Operacional, 99 - Centro',
    });

    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-commerce-status',
      url: 'https://pay.test/plink-commerce-status',
    });

    const checkout = await checkoutShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      billingType: 'PIX',
      paymentLinkName: 'Pedido operacional',
    });

    await eventBus.publish(
      new PaymentConfirmedIntegrationEvent({
        tenantId,
        paymentId: 'pay-commerce-status',
        amount: 35,
        rawReference: checkout.order.paymentReference ?? undefined,
        confirmedAt: new Date(),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const operatorId = crypto.randomUUID();

    const preparing = await updateCommerceOrderStatus.execute({
      tenantId,
      orderId: checkout.order.id,
      status: 'PREPARING',
      userId: operatorId,
      userName: 'Operação',
    });

    expect(preparing.status).toBe('PREPARING');

    const delivered = await updateCommerceOrderStatus.execute({
      tenantId,
      orderId: checkout.order.id,
      status: 'OUT_FOR_DELIVERY',
      userId: operatorId,
      userName: 'Operação',
    });

    expect(delivered.status).toBe('OUT_FOR_DELIVERY');

    const persisted = await commerceRepository.findOrderById(
      tenantId,
      checkout.order.id,
    );
    expect(persisted?.status).toBe('OUT_FOR_DELIVERY');
  });

  it('should detect an abandoned shopping session only once per interval', async () => {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const syncInventory = app.get(SyncInventoryItemUseCase);
    const startShoppingSession = app.get(StartShoppingSessionUseCase);
    const addItemToShoppingSession = app.get(AddItemToShoppingSessionUseCase);
    const detectAbandonedSessions = app.get(
      DetectAbandonedShoppingSessionsUseCase,
    );
    const checkoutShoppingSession = app.get(CheckoutShoppingSessionUseCase);
    const updateAbandonmentState = app.get(
      UpdateCommerceAbandonmentStateUseCase,
    );
    const triggerAbandonmentTouch = app.get(
      TriggerCommerceAbandonmentTouchUseCase,
    );
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    const eventBus = app.get<IEventBus>(EVENT_BUS);

    const category = await createCategory.execute({
      tenantId,
      name: 'Carrinho abandonado',
    });

    const catalogItem = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cookie artesanal',
      basePrice: '9.50',
      tags: ['cookie', 'doce'],
    });

    const inventoryItem = await syncInventory.execute({
      tenantId,
      catalogItemId: catalogItem.id,
      sku: `COOKIE-${String(Date.now()).slice(-4)}`,
      name: 'Cookie artesanal',
      availableQuantity: 15,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '9.50',
      source: 'MANUAL_SNAPSHOT',
    });

    const session = await startShoppingSession.execute({
      tenantId,
      conversationId: crypto.randomUUID(),
    });

    await addItemToShoppingSession.execute({
      tenantId,
      sessionId: session.id,
      inventoryItemId: inventoryItem.id,
      quantity: 2,
    });

    const staleTime = new Date('2026-04-08T21:00:00.000Z');
    await prisma.$executeRaw(Prisma.sql`
      UPDATE commerce_schema.shopping_sessions
      SET updated_at = ${new Date('2026-04-08T19:30:00.000Z')}
      WHERE id = ${session.id}::uuid
    `);

    const originalPublish = eventBus.publish.bind(eventBus);
    const publishedEvents: unknown[] = [];
    const publishSpy = jest
      .spyOn(eventBus, 'publish')
      .mockImplementation(async (event) => {
        publishedEvents.push(event);
        return originalPublish(event);
      });

    try {
      const firstRun = await detectAbandonedSessions.execute({
        now: staleTime,
        limitPerInterval: 20,
      });

      expect(firstRun.triggered).toContainEqual({
        sessionId: session.id,
        tenantId,
        interval: '1h',
      });

      const abandonedEvent = publishedEvents.find(
        (event) =>
          typeof event === 'object' &&
          event != null &&
          'queue' in event &&
          event.queue === 'commerce.session.abandoned',
      ) as { payload?: Record<string, unknown> } | undefined;

      expect(abandonedEvent?.payload).toMatchObject({
        sessionId: session.id,
        tenantId,
        interval: '1h',
        subtotalAmount: 19,
      });

      const secondRun = await detectAbandonedSessions.execute({
        now: staleTime,
        limitPerInterval: 20,
      });

      expect(
        secondRun.triggered.filter((item) => item.sessionId === session.id),
      ).toHaveLength(0);

      jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
        id: 'plink-commerce-abandonment',
        url: 'https://pay.test/plink-commerce-abandonment',
      });

      const readySession = await commerceRepository.updateSessionState({
        tenantId,
        sessionId: session.id,
        fulfillmentType: 'PICKUP',
        currentStep: 'READY_FOR_CHECKOUT',
        status: 'READY_FOR_CHECKOUT',
      });

      const checkout = await checkoutShoppingSession.execute({
        tenantId,
        sessionId: readySession.id,
        billingType: 'PIX',
        paymentLinkName: 'Pedido abandono',
      });

      await updateAbandonmentState.execute({
        tenantId,
        orderId: checkout.order.id,
        paused: true,
        userId: crypto.randomUUID(),
        userName: 'Operação',
      });

      await prisma.$executeRaw(Prisma.sql`
        UPDATE commerce_schema.shopping_sessions
        SET updated_at = ${new Date('2026-04-08T18:30:00.000Z')}
        WHERE id = ${session.id}::uuid
      `);

      const pausedRun = await detectAbandonedSessions.execute({
        now: staleTime,
        limitPerInterval: 20,
      });

      expect(
        pausedRun.triggered.filter((item) => item.sessionId === session.id),
      ).toHaveLength(0);

      await triggerAbandonmentTouch.execute({
        tenantId,
        orderId: checkout.order.id,
        userId: crypto.randomUUID(),
        userName: 'Operação',
      });

      const manualTouchRecorded =
        await commerceRepository.listSessionAbandonmentTouches(
          tenantId,
          session.id,
        );
      expect(
        manualTouchRecorded.some((touch) => touch.interval === 'manual'),
      ).toBe(true);
    } finally {
      publishSpy.mockRestore();
    }
  });

  it('should advance the conversational checkout state from discovery to payment link', async () => {
    const createCategory = app.get(CreateCatalogCategoryUseCase);
    const createItem = app.get(CreateCatalogItemUseCase);
    const syncInventory = app.get(SyncInventoryItemUseCase);
    const configureShippingPolicy = app.get(ConfigureShippingPolicyUseCase);
    const advanceCommerceConversation = app.get(
      AdvanceCommerceConversationUseCase,
    );
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Conversacional',
        phone: '21993001111',
        stage: 'LEAD',
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    const category = await createCategory.execute({
      tenantId,
      name: 'Mercearia conversacional',
    });

    const cafeTorrado = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe torrado 500g',
      basePrice: '14.90',
      tags: ['cafe', 'bebida'],
    });

    const cafeGourmet = await createItem.execute({
      tenantId,
      categoryId: category.id,
      type: 'PRODUCT',
      name: 'Cafe gourmet 250g',
      basePrice: '22.50',
      tags: ['cafe', 'gourmet'],
    });

    await syncInventory.execute({
      tenantId,
      catalogItemId: cafeTorrado.id,
      sku: `CAFET-${String(Date.now()).slice(-4)}`,
      name: 'Cafe torrado 500g',
      availableQuantity: 30,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '14.90',
      source: 'MANUAL_SNAPSHOT',
    });

    await syncInventory.execute({
      tenantId,
      catalogItemId: cafeGourmet.id,
      sku: `CAFEG-${String(Date.now()).slice(-4)}`,
      name: 'Cafe gourmet 250g',
      availableQuantity: 12,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '22.50',
      source: 'MANUAL_SNAPSHOT',
    });

    await configureShippingPolicy.execute({
      tenantId,
      mode: 'FIXED',
      fixedAmount: 7,
      notes: 'Entrega local fixa',
    });

    const selecting = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: 'cafe',
    });

    expect(selecting?.currentStep).toBe('SELECTING_ITEM');
    expect(selecting?.pendingOptions.length).toBeGreaterThanOrEqual(2);

    const awaitingQuantity = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: '1',
    });

    expect(awaitingQuantity?.currentStep).toBe('AWAITING_QUANTITY');
    expect(awaitingQuantity?.selectedItemName).toBeTruthy();

    const askingMore = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: '2',
    });

    expect(askingMore?.currentStep).toBe('ASKING_MORE_ITEMS');
    expect(askingMore?.items).toHaveLength(1);
    expect(askingMore?.subtotalAmount).toBeGreaterThan(0);

    const awaitingFulfillment = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: 'não, finalizar',
    });

    expect(awaitingFulfillment?.currentStep).toBe('AWAITING_FULFILLMENT');

    const awaitingOrderNote = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: 'retirada',
    });

    expect(awaitingOrderNote?.currentStep).toBe('AWAITING_ORDER_NOTE');
    expect(awaitingOrderNote?.fulfillmentType).toBe('PICKUP');

    const readyForCheckout = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: 'deixar separado com o nome Joana',
    });

    expect(readyForCheckout?.currentStep).toBe('READY_FOR_CHECKOUT');
    expect(readyForCheckout?.notes).toBe('deixar separado com o nome Joana');

    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-commerce-conversation',
      url: 'https://pay.test/plink-commerce-conversation',
    });

    const awaitingPayment = await advanceCommerceConversation.execute({
      tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      businessType: 'MARKET',
      userMessage: 'pode mandar o link',
    });

    expect(awaitingPayment?.currentStep).toBe('AWAITING_PAYMENT');
    expect(awaitingPayment?.paymentLinkUrl).toBe(
      'https://pay.test/plink-commerce-conversation',
    );
    expect(awaitingPayment?.paymentStatus).toBe('PENDING');

    const order = await commerceRepository.findOrderByPaymentReference(
      tenantId,
      awaitingPayment?.paymentReference ?? '',
    );

    expect(order?.status).toBe('AWAITING_PAYMENT');
    expect(order?.paymentLinkUrl).toBe(
      'https://pay.test/plink-commerce-conversation',
    );
  });
});
