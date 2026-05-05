export function buildRecoveryPaymentReference(
  tenantId: string,
  caseId: string,
): string {
  return `recovery|${tenantId}|${caseId}`;
}

export function parseRecoveryPaymentReference(rawReference?: string | null): {
  tenantId: string;
  caseId: string;
} | null {
  if (!rawReference) {
    return null;
  }

  const match = /^recovery\|([^|]+)\|([^|]+)$/.exec(rawReference);

  if (!match) {
    return null;
  }

  return {
    tenantId: match[1],
    caseId: match[2],
  };
}
