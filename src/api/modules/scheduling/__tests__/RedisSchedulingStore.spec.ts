import { RedisSchedulingStore } from '../infrastructure/persistence/RedisSchedulingStore';
import { AvailabilitySlotRecord } from '../domain/ports/ISchedulingStore';

function buildSlot(
  overrides: Partial<AvailabilitySlotRecord> = {},
): AvailabilitySlotRecord {
  return {
    id: '2030-07-20__19:00__20:00',
    startsAt: '19:00',
    endsAt: '20:00',
    status: 'PRE_RESERVED',
    reservedFor: { contactId: 'contact-1' },
    payment: {
      reference: 'sch|tenant1|prof1|2030-07-20__19:00__20:00',
      linkId: 'link-1',
      linkUrl: 'https://pay/x',
      amount: 100,
      billingType: 'PIX',
      status: 'PENDING',
    },
    ...overrides,
  };
}

describe('RedisSchedulingStore.markSlotPaymentConfirmedByReference', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const professionalId = '22222222-2222-2222-2222-222222222222';
  const date = '2030-07-20';
  const slotId = '2030-07-20__19:00__20:00';
  const paymentReference = 'sch|tenant1|prof1|2030-07-20__19:00__20:00';

  function makeRedis(slot: AvailabilitySlotRecord | null) {
    const exec = jest.fn().mockResolvedValue([[null, 'OK']]);
    const multi = { hset: jest.fn().mockReturnThis(), exec };
    return {
      keys: jest.fn(),
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      hget: jest
        .fn()
        .mockResolvedValue(slot ? JSON.stringify(slot) : null),
      multi: jest.fn().mockReturnValue(multi),
      __multi: multi,
    };
  }

  it('resolves the slot via O(1) hget and never scans the keyspace', async () => {
    const redis = makeRedis(buildSlot());
    const store = new RedisSchedulingStore(redis as never);

    const result = await store.markSlotPaymentConfirmedByReference({
      tenantId,
      professionalId,
      date,
      slotId,
      paymentReference,
      confirmedAt: '2030-07-20T19:05:00.000Z',
    });

    expect(redis.keys).not.toHaveBeenCalled();
    expect(redis.hget).toHaveBeenCalledTimes(1);
    expect(result.appliedChange).toBe(true);
    expect(result.slot?.status).toBe('RESERVED');
    expect(result.slot?.payment?.status).toBe('PAID');
  });

  it('is idempotent when the slot is already PAID', async () => {
    const redis = makeRedis(
      buildSlot({
        status: 'RESERVED',
        payment: {
          reference: paymentReference,
          linkId: 'link-1',
          linkUrl: 'https://pay/x',
          amount: 100,
          billingType: 'PIX',
          status: 'PAID',
        },
      }),
    );
    const store = new RedisSchedulingStore(redis as never);

    const result = await store.markSlotPaymentConfirmedByReference({
      tenantId,
      professionalId,
      date,
      slotId,
      paymentReference,
      confirmedAt: '2030-07-20T19:05:00.000Z',
    });

    expect(result.appliedChange).toBe(false);
    expect(redis.__multi.exec).not.toHaveBeenCalled();
  });

  it('returns no change when the reference does not match the slot', async () => {
    const redis = makeRedis(
      buildSlot({
        payment: {
          reference: 'sch|other|other|2030-07-20__19:00__20:00',
          linkId: 'link-1',
          linkUrl: 'https://pay/x',
          amount: 100,
          billingType: 'PIX',
          status: 'PENDING',
        },
      }),
    );
    const store = new RedisSchedulingStore(redis as never);

    const result = await store.markSlotPaymentConfirmedByReference({
      tenantId,
      professionalId,
      date,
      slotId,
      paymentReference,
      confirmedAt: '2030-07-20T19:05:00.000Z',
    });

    expect(result.slot).toBeNull();
    expect(result.appliedChange).toBe(false);
  });

  it('retries on optimistic-lock conflict (concurrent mutation) then applies once', async () => {
    const redis = makeRedis(buildSlot());
    // First EXEC returns null (WATCH conflict), second succeeds.
    redis.__multi.exec
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([[null, 'OK']]);
    const store = new RedisSchedulingStore(redis as never);

    const result = await store.markSlotPaymentConfirmedByReference({
      tenantId,
      professionalId,
      date,
      slotId,
      paymentReference,
      confirmedAt: '2030-07-20T19:05:00.000Z',
    });

    expect(redis.keys).not.toHaveBeenCalled();
    expect(redis.__multi.exec).toHaveBeenCalledTimes(2);
    expect(result.appliedChange).toBe(true);
  });
});
