/**
 * T2-F security tests: PrismaPaymentWebhookReceiptStore concurrent dedup.
 *
 * The fix must handle the case where $queryRaw returns 0 rows (concurrent INSERT
 * wins the race and ON CONFLICT DO NOTHING fires, but the UNION ALL SELECT also
 * races).  In that scenario registerReceived must retry / re-query to get the
 * existing row and return { isNew: false }.
 *
 * TDD: written BEFORE the fix.  The test that simulates 0-row CTE response
 * currently throws an unhandled TypeError because receipt.id is accessed on
 * undefined.
 */
import { PrismaPaymentWebhookReceiptStore } from '../infrastructure/persistence/PrismaPaymentWebhookReceiptStore';
import { Prisma } from '@prisma/client';

const mockEvent = {
  provider: 'ASAAS' as const,
  eventType: 'PAYMENT_RECEIVED',
  paymentId: 'pay-1',
  tenantId: 'tenant-1',
  rawReference: null,
  rawPayload: { id: 'pay-1' },
};

describe('PrismaPaymentWebhookReceiptStore – concurrent dedup (T2-F)', () => {
  let store: PrismaPaymentWebhookReceiptStore;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn(),
    };
    store = new PrismaPaymentWebhookReceiptStore(prismaMock as any);
  });

  it('T2-F: returns { isNew: true } when INSERT wins', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'receipt-uuid', inserted: true },
    ]);

    const result = await store.registerReceived(mockEvent);

    expect(result).toEqual({ id: 'receipt-uuid', isNew: true });
  });

  it('T2-F: returns { isNew: false } when conflict detected (existing row returned)', async () => {
    // INSERT conflicts → UNION ALL SELECT returns the existing row
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'receipt-existing', inserted: false },
    ]);

    const result = await store.registerReceived(mockEvent);

    expect(result).toEqual({ id: 'receipt-existing', isNew: false });
  });

  it('T2-F: handles concurrent race (CTE returns 0 rows) without throwing', async () => {
    // Race condition: both INSERT race; ON CONFLICT fires for both, so the
    // initial $queryRaw CTE returns 0 rows.  The fix must handle this gracefully.
    prismaMock.$queryRaw
      .mockResolvedValueOnce([]) // first call: race → 0 rows
      .mockResolvedValueOnce([{ id: 'receipt-raced', inserted: false }]); // retry fetch

    const result = await store.registerReceived(mockEvent);

    expect(result).toEqual({ id: 'receipt-raced', isNew: false });
    // Must have called $queryRaw twice (original CTE + fallback SELECT)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('T2-F: throws when fallback SELECT also returns nothing (DB error scenario)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(store.registerReceived(mockEvent)).rejects.toThrow();
  });
});
