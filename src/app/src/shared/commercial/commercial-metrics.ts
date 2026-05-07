import type { RecoveryCase, SalesPaymentLinksSummary } from '@/shared/types';

export type CommercialRevenueSnapshot = {
  paidRevenue: number;
  paidLinks: number;
  newSaleRevenue: number;
  newSalePaymentsCount: number;
  recoveredRevenue: number;
  recoveredPaymentsCount: number;
};

export function buildCommercialRevenueSnapshot(
  paymentSummary?: SalesPaymentLinksSummary | null,
  recoveryCases: Array<Pick<RecoveryCase, 'status' | 'paidAt' | 'amountDue'>> = [],
): CommercialRevenueSnapshot {
  const recoveredCases = recoveryCases.filter(
    (item) => item.status === 'PAID' || Boolean(item.paidAt),
  );
  const recoveredRevenue = recoveredCases.reduce(
    (total, item) => total + (item.amountDue ?? 0),
    0,
  );
  const recoveredPaymentsCount = recoveredCases.length;
  const paidRevenue = paymentSummary?.paidRevenue ?? 0;
  const paidLinks = paymentSummary?.paidLinks ?? 0;

  return {
    paidRevenue,
    paidLinks,
    recoveredRevenue,
    recoveredPaymentsCount,
    newSaleRevenue: Math.max(0, paidRevenue - recoveredRevenue),
    newSalePaymentsCount: Math.max(0, paidLinks - recoveredPaymentsCount),
  };
}
