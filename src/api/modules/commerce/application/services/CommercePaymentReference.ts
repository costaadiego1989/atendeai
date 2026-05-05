export function buildCommercePaymentReference(input: {
  tenantId: string;
  orderId: string;
}) {
  return `commerce|${input.tenantId}|${input.orderId}`;
}

export function parseCommercePaymentReference(rawReference?: string | null): {
  tenantId: string;
  orderId: string;
} | null {
  if (!rawReference) {
    return null;
  }

  const match = /^commerce\|([^|]+)\|([^|]+)$/.exec(rawReference);
  if (!match) {
    return null;
  }

  return {
    tenantId: match[1]!,
    orderId: match[2]!,
  };
}
