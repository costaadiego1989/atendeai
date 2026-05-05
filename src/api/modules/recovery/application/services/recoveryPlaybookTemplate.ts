import { RecoveryCaseRecord } from '../../domain/ports/IRecoveryRepository';

/**
 * Substitui placeholders simples em templates de fase (modo TEMPLATE).
 * Evita injeção: não interpreta HTML; só troca chaves conhecidas.
 */
export function applyRecoveryPlaybookTemplate(
  template: string,
  recoveryCase: RecoveryCaseRecord,
): string {
  const due =
    recoveryCase.dueDate instanceof Date
      ? recoveryCase.dueDate.toISOString().slice(0, 10)
      : recoveryCase.dueDate
        ? String(recoveryCase.dueDate).slice(0, 10)
        : '';

  const map: Record<string, string> = {
    debtorName: recoveryCase.debtorName ?? '',
    debtorCompanyName: recoveryCase.debtorCompanyName ?? '',
    chargeTitle: recoveryCase.chargeTitle ?? '',
    amountDue: recoveryCase.amountDue ?? '',
    dueDate: due,
    phone: recoveryCase.phone ?? '',
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? '');
}

export function daysPastDue(dueDate: Date | null | undefined, now: Date): number {
  if (!dueDate) {
    return 0;
  }
  const d = new Date(dueDate);
  d.setUTCHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setUTCHours(0, 0, 0, 0);
  const diff = Math.floor((n.getTime() - d.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}
