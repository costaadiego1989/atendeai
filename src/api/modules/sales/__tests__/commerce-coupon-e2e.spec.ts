import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { COMMERCE_REPOSITORY } from '../../commerce/domain/ports/ICommerceRepository';
import { SALES_REPOSITORY } from '../domain/repositories/ISalesRepository';

import { JwtCookieGuard } from '../../../shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '../../../shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '../../../shared/infrastructure/auth/guards/TenantGuard';

describe('Commerce Coupon E2E', () => {
  let app: INestApplication;
  const commerceRepo = {
    findSessionById: jest.fn(),
    updateSessionState: jest.fn(),
  };
  const salesRepo = {
    findCouponByCode: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(COMMERCE_REPOSITORY)
      .useValue(commerceRepo)
      .overrideProvider(SALES_REPOSITORY)
      .useValue(salesRepo)
      .overrideGuard(JwtCookieGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 30000); // Higher timeout for Nest initialization

  afterAll(async () => {
    await app.close();
  });

  it('should apply a 15% discount to a session', async () => {
    const tenantId = 'test-tenant';
    const sessionId = 'test-session';

    // Mock session with 200.00 subtotal
    commerceRepo.findSessionById.mockResolvedValue({
      id: sessionId,
      tenantId,
      subtotalAmount: 200,
      freightAmount: 20,
      totalAmount: 220,
      items: [{ name: 'Item 1', quantity: 2, unitPrice: 100, lineTotal: 200 }],
      status: 'BUILDING_CART',
    });

    // Mock coupon 15% OFF
    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      code: 'OFF15',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      active: true,
      startsAt: new Date(2020, 1, 1),
      expiresAt: new Date(2030, 1, 1),
      maxUses: 100,
      usedCount: 0,
      minimumOrder: 50,
    });

    // We expect updateSessionState to be called with:
    // Subtotal: 200
    // Discount: 30 (15% of 200)
    // Total: 200 + 20 - 30 = 190
    commerceRepo.updateSessionState.mockImplementation((dto) =>
      Promise.resolve({ ...dto }),
    );

    const response = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/commerce/sessions/${sessionId}/coupon`)
      .send({ code: 'OFF15' });

    expect(response.status).toBe(201);
    expect(response.body.discountAmount).toBe(30);
    expect(response.body.totalAmount).toBe(190);
    expect(response.body.couponCode).toBe('OFF15');
  });
});
