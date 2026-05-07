import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiKeyGuard } from '../../../shared/infrastructure/guards/ApiKeyGuard';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { IntegrationController } from '../../tenant/presentation/controllers/IntegrationController';
import { CreateExternalTenantUseCase } from '../../tenant/application/use-cases/CreateExternalTenantUseCase';
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

describe('Messaging Promotions and Coupons Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationController, CommerceController],
      providers: [
        { provide: CreateExternalTenantUseCase, useValue: { execute: jest.fn() } },
        { provide: ConfigureShippingPolicyUseCase, useValue: { execute: jest.fn() } },
        { provide: GetShippingPolicyUseCase, useValue: { execute: jest.fn() } },
        { provide: SearchCommerceCatalogUseCase, useValue: { execute: jest.fn() } },
        { provide: StartShoppingSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: GetShoppingSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: AddItemToShoppingSessionUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ApplyCouponToShoppingSessionUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              id: 'session-1',
              couponCode: 'BEMVINDO10',
              discountAmount: 10,
              totalAmount: 90,
            }),
          },
        },
        { provide: UpdateShoppingSessionFulfillmentUseCase, useValue: { execute: jest.fn() } },
        { provide: CheckoutShoppingSessionUseCase, useValue: { execute: jest.fn() } },
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
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().tenant = {
            companyName: { value: 'Loja Promocional' },
            businessType: 'RETAIL',
            description: 'Loja com promocoes e cupons ativos.',
            promotions: [
              {
                title: 'Frete gratis',
                description: 'Frete gratis acima de R$ 100',
                value: 'R$ 0',
                imageUrl: null,
              },
            ],
            operatingHours: null,
            catalogUrl: 'https://empresa.test/catalogo',
          };
          return true;
        },
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

  it('returns active promotions and applies a valid coupon before checkout', async () => {
    const promotions = await request(app.getHttpServer())
      .get('/api/v1/tenant/external/config')
      .set('x-api-key', 'valid-key')
      .expect(200);

    expect(promotions.body.promotions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Frete gratis',
        }),
      ]),
    );

    const coupon = await request(app.getHttpServer())
      .post('/api/v1/tenants/tenant-1/commerce/sessions/session-1/coupon')
      .send({ code: 'BEMVINDO10' })
      .expect(201);

    expect(coupon.body).toEqual(
      expect.objectContaining({
        couponCode: 'BEMVINDO10',
        discountAmount: 10,
        totalAmount: 90,
      }),
    );
  });
});
