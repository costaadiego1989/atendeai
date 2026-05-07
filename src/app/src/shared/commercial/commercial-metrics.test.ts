import { describe, expect, it } from 'vitest';
import { buildCommercialRevenueSnapshot } from './commercial-metrics';

describe('commercial-metrics', () => {
  it('separates new sale revenue from recovered revenue', () => {
    expect(
      buildCommercialRevenueSnapshot(
        {
          totalLinks: 8,
          activeLinks: 2,
          pausedLinks: 0,
          paidLinks: 4,
          expiredLinks: 1,
          estimatedRevenue: 1600,
          paidRevenue: 1000,
        },
        [
          {
            status: 'PAID',
            amountDue: 250,
          },
          {
            status: 'PAID',
            amountDue: 150,
          },
        ],
      ),
    ).toEqual({
      paidRevenue: 1000,
      paidLinks: 4,
      recoveredRevenue: 400,
      recoveredPaymentsCount: 2,
      newSaleRevenue: 600,
      newSalePaymentsCount: 2,
    });
  });

  it('never returns negative new sale revenue when recovery exceeds the paid summary', () => {
    expect(
      buildCommercialRevenueSnapshot(
        {
          totalLinks: 1,
          activeLinks: 0,
          pausedLinks: 0,
          paidLinks: 1,
          expiredLinks: 0,
          estimatedRevenue: 300,
          paidRevenue: 200,
        },
        [
          {
            status: 'PAID',
            amountDue: 260,
          },
        ],
      ),
    ).toEqual(
      expect.objectContaining({
        newSaleRevenue: 0,
        newSalePaymentsCount: 0,
        recoveredRevenue: 260,
      }),
    );
  });
});
