import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

const CURRENT_PREFIX = 'sch';
const LEGACY_PREFIX = 'scheduling';

function compactUuid(value: string): string {
  return value.replace(/-/g, '');
}

function expandUuid(value: string): string {
  if (/^[0-9a-fA-F]{32}$/.test(value)) {
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`.toLowerCase();
  }

  return value;
}

export interface SchedulingPaymentReferenceParts {
  tenantId: string;
  professionalId: string;
  date: string;
  slotId: string;
}

export function buildSchedulingPaymentReference(
  input: SchedulingPaymentReferenceParts,
): string {
  return `${CURRENT_PREFIX}|${compactUuid(input.tenantId)}|${compactUuid(input.professionalId)}|${input.slotId}`;
}

function hasSchedulingPrefix(rawReference: string): boolean {
  return (
    rawReference.startsWith(`${CURRENT_PREFIX}|`) ||
    rawReference.startsWith(`${LEGACY_PREFIX}|`)
  );
}

/**
 * Tolerant parse: returns null when the reference does not belong to scheduling
 * (the payment subscriber sees references from every module). When the
 * reference *claims* to be a scheduling reference but is structurally invalid,
 * it is rejected with a domain exception rather than silently dropped.
 */
export function parseSchedulingPaymentReference(
  rawReference?: string | null,
): SchedulingPaymentReferenceParts | null {
  if (!rawReference || !hasSchedulingPrefix(rawReference)) {
    return null;
  }

  const compactMatch = /^sch\|([^|]+)\|([^|]+)\|(.+)$/.exec(rawReference);
  if (compactMatch) {
    const slotId = compactMatch[3];
    const dateFromSlot = /^(\d{4}-\d{2}-\d{2})__/.exec(slotId)?.[1];

    if (!dateFromSlot) {
      throw new DomainException(
        'Malformed scheduling payment reference: slot id does not encode a date',
        'SCHEDULING_PAYMENT_REFERENCE_MALFORMED',
      );
    }

    return {
      tenantId: expandUuid(compactMatch[1]),
      professionalId: expandUuid(compactMatch[2]),
      date: dateFromSlot,
      slotId,
    };
  }

  const match =
    /^scheduling\|([^|]+)\|([^|]+)\|(\d{4}-\d{2}-\d{2})\|(.+)$/.exec(
      rawReference,
    );

  if (!match) {
    throw new DomainException(
      'Malformed scheduling payment reference',
      'SCHEDULING_PAYMENT_REFERENCE_MALFORMED',
    );
  }

  return {
    tenantId: match[1],
    professionalId: match[2],
    date: match[3],
    slotId: match[4],
  };
}
