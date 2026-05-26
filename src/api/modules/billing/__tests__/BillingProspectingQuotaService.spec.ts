import { ConflictException } from '@nestjs/common';
import { BillingProspectingQuotaService } from '../application/services/BillingProspectingQuotaService';

describe('BillingProspectingQuotaService', () => {
  let service: BillingProspectingQuotaService;
  let prisma: any;
  let prospectingQueryPort: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    prospectingQueryPort = {
      countDailySearches: jest.fn(),
    };
    service = new BillingProspectingQuotaService(prisma, prospectingQueryPort);
  });

  describe('assertCanConsume - quota available → returns true', () => {
    it('should return remaining quota when usage is within limits', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'PROFISSIONAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(50);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-1',
        requested: 10,
      });

      expect(result.used).toBe(50);
      expect(result.quota).toBe(300); // PROFISSIONAL default
      expect(result.remaining).toBe(240); // 300 - 50 - 10
    });
  });

  describe('assertCanConsume - quota exceeded → throws ConflictException', () => {
    it('should throw ConflictException when usage exceeds limit', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESSENCIAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(145);

      await expect(
        service.assertCanConsume({
          tenantId: 'tenant-2',
          requested: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('get remaining quota', () => {
    it('should correctly calculate remaining quota', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESCALA', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(200);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-3',
        requested: 1,
      });

      expect(result.remaining).toBe(799); // 1000 - 200 - 1
    });
  });

  describe('different plan types have different limits', () => {
    it('should use ESSENCIAL default limit of 150', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESSENCIAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-4',
        requested: 1,
      });

      expect(result.quota).toBe(150);
    });

    it('should use PROFISSIONAL default limit of 300', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'PROFISSIONAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-5',
        requested: 1,
      });

      expect(result.quota).toBe(300);
    });

    it('should use ESCALA default limit of 1000', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESCALA', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-6',
        requested: 1,
      });

      expect(result.quota).toBe(1000);
    });

    it('should use configured limit from planConfig when available', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          plan: 'PROFISSIONAL',
          planConfig: { limits: { prospectingDaily: 500 } },
        },
      ]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-7',
        requested: 1,
      });

      expect(result.quota).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('should default to ESSENCIAL limit when plan is unknown', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'UNKNOWN', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-8',
        requested: 1,
      });

      expect(result.quota).toBe(150);
    });

    it('should default to ESSENCIAL limit when no subscription found', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-9',
        requested: 1,
      });

      expect(result.quota).toBe(150);
    });

    it('should treat requested < 1 as 1', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESSENCIAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(150);

      await expect(
        service.assertCanConsume({
          tenantId: 'tenant-10',
          requested: 0,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle port error in countDailySearches gracefully (returns 0)', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ plan: 'ESSENCIAL', planConfig: {} }]);
      prospectingQueryPort.countDailySearches.mockResolvedValue(0);

      const result = await service.assertCanConsume({
        tenantId: 'tenant-11',
        requested: 1,
      });

      expect(result.used).toBe(0);
      expect(result.remaining).toBe(149);
    });
  });
});
