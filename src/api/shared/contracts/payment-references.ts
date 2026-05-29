export const RECOVERY_PAYMENT_REFERENCE_PREFIX = 'recovery';

const RECOVERY_PAYMENT_REFERENCE_REGEX = /^recovery\|([^|]+)\|([^|]+)$/;

export interface RecoveryPaymentReferenceParts {
  tenantId: string;
  caseId: string;
}

export function buildRecoveryPaymentReference(
  tenantId: string,
  caseId: string,
): string {
  return `${RECOVERY_PAYMENT_REFERENCE_PREFIX}|${tenantId}|${caseId}`;
}

export function parseRecoveryPaymentReference(
  rawReference?: string | null,
): RecoveryPaymentReferenceParts | null {
  if (!rawReference) {
    return null;
  }

  const match = RECOVERY_PAYMENT_REFERENCE_REGEX.exec(rawReference);

  if (!match) {
    return null;
  }

  return {
    tenantId: match[1],
    caseId: match[2],
  };
}

export function isRecoveryPaymentReference(
  rawReference?: string | null,
): boolean {
  if (!rawReference) {
    return false;
  }

  return rawReference.startsWith(`${RECOVERY_PAYMENT_REFERENCE_PREFIX}|`);
}
