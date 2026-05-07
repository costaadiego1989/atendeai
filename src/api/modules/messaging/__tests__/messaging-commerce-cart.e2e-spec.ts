import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { CommerceController } from '../../commerce/presentation/controllers/CommerceController';
import { ConfigureShippingPolicyUseCase } from '../../commerce/application/use-cases/ConfigureShippingPolicyUseCase';
import { GetShippingPolicyUseCase } from '../../commerce/application/use-cases/GetShippingPolicyUseCase';
import { SearchCommerceCatalogUseCase } from '../../commerce/application/use-cases/SearchCommerceCatalogUseCase';
import { StartShoppingSessionUseCase } from '../../commerce/application/use-cases/StartShoppingSessionUseCase';
import { GetShoppingSessionUseCase } from '../../commerce/application/use-cases/GetShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from '../../commerce/application/use-cases/AddItemToShoppingSessionUseCase';
import { ApplyCouponToShoppingSessionUseCase } from '../../commerce/application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from '../../commerce/application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from '../../commerce/application/use-cases/CheckoutShoppingSessionUseCase';
import { ListCommerceOrdersUseCase } from '../../commerce/application/use-cases/ListCommerceOrdersUseCase';
import { GetCommerceOrderDetailsUseCase } from '../../commerce/application/use-cases/GetCommerceOrderDetailsUseCase';
import { UpdateCommerceOrderStatusUseCase } from '../../commerce/application/use-cases/UpdateCommerceOrderStatusUseCase';
import { UpdateCommerceAbandonmentStateUseCase } from '../../commerce/application/use-cases/UpdateCommerceAbandonmentStateUseCase';
import { TriggerCommerceAbandonmentTouchUseCase } from '../../commerce/application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import { GetAbandonmentConfigUseCase } from '../../commerce/application/use-cases/GetAbandonmentConfigUseCase';
import { UpdateAbandonmentConfigUseCase } from '../../commerce/application/use-cases/UpdateAbandonmentConfigUseCase';
import { GenerateAbandonmentMessageUseCase } from '../../commerce/application/use-cases/GenerateAbandonmentMessageUseCase';
import { CommerceOrdersReportCsvBuilder } from '../../commerce/application/services/CommerceOrdersReportCsvBuilder';

describe('Messaging Commerce Cart Flow (e2e)', () => {
  let app: INestApplication;

  const startSessionUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'BUILDING_CART',
      subtotalAmount: 0,
      totalAmount: 0,
      items: [],
    }),
  };

  const addItemUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'session-1',
      subtotalAmount: 200,
      totalAmount: 200,
      items: [
        {
          name: 'Cafe 500g',
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
        },
      ],
    }),
  };

  const applyCouponUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'session-1',
      couponCode: 'BEMVINDO10',
      discountAmount: 20,
      subtotalAmount: 200,
      totalAmount: 180,
    }),
  };

  const checkoutUseCase = {
    execute: jest.fn().mockResolvedValue({
      orderId: 'order-1',
      sessionId: 'session-1',
      paymentLinkId: 'plink-1',
      paymentLinkUrl: 'https://pay.test/plink-1',
      totalAmount: 180,
      paymentStatus: 'PENDING',
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CommerceController],
      providers: [
        { provide: ConfigureShippingPolicyUseCase, useValue: { execute: jest.fn() } },
        { provide: GetShippingPolicyUseCase, useValue: { execute: jest.fn() } },
        { provide: SearchCommerceCatalogUseCase, useValue: { execute: jest.fn() } },
        { provide: StartShoppingSessionUseCase, useValue: startSessionUseCase },
        { provide: GetShoppingSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: AddItemToShoppingSessionUseCase, useValue: addItemUseCase },
        { provide: ApplyCouponToShoppingSessionUseCase, useValue: applyCouponUseCase },
        { provide: UpdateShoppingSessionFulfillmentUseCase, useValue: { execute: jest.fn() } },
        { provide: CheckoutShoppingSessionUseCase, useValue: checkoutUseCase },
        { provide: ListCommerceOrdersUseCase, useValue: { execute: jest.fn() } },
        { provide: GetCommerceOrderDetailsUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateCommerceOrderStatusUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateCommerceAbandonmentStateUseCase, useValue: { execute: jest.fn() } },
        { provide: TriggerCommerceAbandonmentTouchUseCase, useValue: { execute: jest.fn() } },
        { provide: GetAbandonmentConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateAbandonmentConfigUseCase, useValue: { execute: jest.fn() } },
        { provide: GenerateAbandonmentMessageUseCase, useValue: { execute: jest.fn() } },
        { provide: CommerceOrdersReportCsvBuilder, useValue: { build: jest.fn() } },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a cart, adds items, applies coupon and creates a payment link at checkout', async () => {
    const sessionResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/commerce/sessions')
      .send({
        conversationId: 'conversation-1',
        contactId: 'contact-1',
      })
      .expect(201);

    expect(sessionResponse.body).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: 'BUILDING_CART',
      }),
    );

    const itemResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/commerce/sessions/session-1/items')
      .send({
        catalogItemId: 'item-1',
        quantity: 2,
      })
      .expect(201);

    expect(itemResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Cafe 500g',
          quantity: 2,
        }),
      ]),
    );

    const couponResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/commerce/sessions/session-1/coupon')
      .send({ code: 'BEMVINDO10' })
      .expect(201);

    expect(couponResponse.body).toEqual(
      expect.objectContaining({
        couponCode: 'BEMVINDO10',
        discountAmount: 20,
        totalAmount: 180,
      }),
    );

    const checkoutResponse = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/commerce/sessions/session-1/checkout')
      .send({
        billingType: 'PIX',
        paymentLinkName: 'Pedido Cafe',
      })
      .expect(201);

    expect(checkoutResponse.body).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        paymentLinkId: 'plink-1',
        paymentLinkUrl: 'https://pay.test/plink-1',
        totalAmount: 180,
      }),
    );
  });
});
