import { DomainException } from '@shared/domain/exceptions/DomainExceptions';
import {
  buildSchedulingPaymentReference,
  parseSchedulingPaymentReference,
} from '../application/services/SchedulingPaymentReference';

describe('SchedulingPaymentReference', () => {
  const parts = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    professionalId: '22222222-2222-2222-2222-222222222222',
    date: '2030-07-20',
    slotId: '2030-07-20__19:00__20:00',
  };

  it('round-trips build -> parse for all fields', () => {
    const reference = buildSchedulingPaymentReference(parts);
    const parsed = parseSchedulingPaymentReference(reference);

    expect(parsed).toEqual(parts);
  });

  it('returns null for a non-scheduling reference (other module payment)', () => {
    expect(parseSchedulingPaymentReference('commerce|abc|123')).toBeNull();
    expect(parseSchedulingPaymentReference(undefined)).toBeNull();
    expect(parseSchedulingPaymentReference(null)).toBeNull();
  });

  it('parses the legacy versioned reference format', () => {
    const parsed = parseSchedulingPaymentReference(
      'scheduling|tenant-1|professional-1|2030-07-20|slot-1',
    );

    expect(parsed).toEqual({
      tenantId: 'tenant-1',
      professionalId: 'professional-1',
      date: '2030-07-20',
      slotId: 'slot-1',
    });
  });

  it('rejects a malformed scheduling-prefixed reference with a domain exception', () => {
    expect(() =>
      parseSchedulingPaymentReference('sch|tenant1|prof1|no-date-slot'),
    ).toThrow(DomainException);
    expect(() =>
      parseSchedulingPaymentReference('scheduling|only|two'),
    ).toThrow(DomainException);
  });
});
