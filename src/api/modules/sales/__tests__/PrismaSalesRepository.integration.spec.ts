import { Test, TestingModule } from '@nestjs/testing';
import { PrismaSalesRepository } from '../infrastructure/persistence/repositories/PrismaSalesRepository';
import { PrismaService } from '../../../../shared/infrastructure/database/PrismaService';
import { SalesPaymentLinksSchemaService } from '../infrastructure/persistence/services/SalesPaymentLinksSchemaService';
import { randomUUID } from 'crypto';

describe('PrismaSalesRepository Integration', () => {
  let repository: PrismaSalesRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaSalesRepository,
        PrismaService,
        SalesPaymentLinksSchemaService,
      ],
    }).compile();

    repository = module.get<PrismaSalesRepository>(PrismaSalesRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const tenantId = randomUUID();

  describe('Promotions', () => {
    let promoId: string;

    it('should create a promotion', async () => {
      promoId = randomUUID();
      const created = await repository.createPromotion({
        id: promoId,
        tenantId,
        title: 'Int Test Promo',
        description: 'Test',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        startsAt: new Date(),
        active: true,
      });

      expect(created.id).toBe(promoId);
      expect(created.title).toBe('Int Test Promo');
    });

    it('should retrieve the promotion', async () => {
      const retrieved = await repository.findPromotionById(tenantId, promoId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(promoId);
    });

    it('should update the promotion', async () => {
      const updated = await repository.updatePromotion(tenantId, promoId, { title: 'Updated Promo' });
      expect(updated?.title).toBe('Updated Promo');
    });

    it('should delete the promotion', async () => {
      await repository.deletePromotion(tenantId, promoId);
      const retrieved = await repository.findPromotionById(tenantId, promoId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Coupons', () => {
    let couponId: string;

    it('should create a coupon', async () => {
      couponId = randomUUID();
      const created = await repository.createCoupon({
        id: couponId,
        tenantId,
        code: 'INT_TEST',
        discountType: 'FIXED_AMOUNT',
        discountValue: 20,
        maxUses: 10,
        startsAt: new Date(),
        active: true,
      });

      expect(created.id).toBe(couponId);
      expect(created.code).toBe('INT_TEST');
    });

    it('should increment coupon usage', async () => {
      const updated = await repository.incrementCouponUsage(tenantId, couponId);
      expect(updated?.usedCount).toBe(1);
    });

    it('should delete the coupon', async () => {
      await repository.deleteCoupon(tenantId, couponId);
      const retrieved = await repository.findCouponById(tenantId, couponId);
      expect(retrieved).toBeNull();
    });
  });
});
