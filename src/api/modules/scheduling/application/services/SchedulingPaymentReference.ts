function compactUuid(value: string): string {
  return value.replace(/-/g, '');
}

function expandUuid(value: string): string {
  if (/^[0-9a-fA-F]{32}$/.test(value)) {
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`.toLowerCase();
  }

  return value;
}

export function buildSchedulingPaymentReference(input: {
  tenantId: string;
  professionalId: string;
  date: string;
  slotId: string;
}): string {
  return `sch|${compactUuid(input.tenantId)}|${compactUuid(input.professionalId)}|${input.slotId}`;
}

export function parseSchedulingPaymentReference(rawReference?: string | null): {
  tenantId: string;
  professionalId: string;
  date: string;
  slotId: string;
} | null {
  if (!rawReference) {
    return null;
  }

  const compactMatch = /^sch\|([^|]+)\|([^|]+)\|(.+)$/.exec(rawReference);
  if (compactMatch) {
    const slotId = compactMatch[3];
    const dateFromSlot = /^(\d{4}-\d{2}-\d{2})__/.exec(slotId)?.[1];

    if (!dateFromSlot) {
      return null;
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
    return null;
  }

  return {
    tenantId: match[1],
    professionalId: match[2],
    date: match[3],
    slotId: match[4],
  };
}
