import {
  Activity,
  Contact2,
  CreditCard,
  MessageSquareText,
  ShoppingCart,
  Siren,
  Wallet,
} from 'lucide-react';
import { KPICard } from '@/shared/ui/KPICard';
import { formatCurrency } from '@/shared/lib/formatters';
import type {
  DashboardMetricValue,
  DashboardWidget,
} from '@/modules/dashboard/services/dashboard-service';

const iconMap = {
  Activity,
  Contact2,
  CreditCard,
  MessageSquareText,
  ShoppingCart,
  Siren,
  Wallet,
};

const currencyMetricKeys = new Set([
  'sales.totalRevenue',
  'payments.paidRevenue',
  'payments.newSaleRevenue',
  'payments.recoveredRevenue',
  'recovery.openAmount',
]);

function formatMetricValue(widget: DashboardWidget, metric?: DashboardMetricValue) {
  const value = metric?.value ?? 0;

  if (currencyMetricKeys.has(widget.queryKey)) {
    return formatCurrency(value);
  }

  return value.toLocaleString('pt-BR');
}

/**
 * Renders KPI widgets inline. CHART and QUEUE widgets are rendered by dedicated
 * components in DashboardPage (DashboardRevenueChart, DashboardOperationsPanel)
 * and are intentionally skipped here — they are NOT missing implementations.
 *
 * Widget → Service → Endpoint mapping:
 * - sales.totalRevenue       → salesService.listPaymentLinks   → GET /sales/payment-links
 * - payments.paidRevenue     → salesService.listPaymentLinks   → GET /sales/payment-links
 * - payments.newSaleRevenue  → salesService.listPaymentLinks + recoveryService → computed
 * - payments.recoveredRevenue→ recoveryService.listCases       → GET /recovery/cases
 * - payments.activeLinks     → salesService.listPaymentLinks   → GET /sales/payment-links
 * - conversations.waitingHuman → messagingService.listConversations → GET /messaging/conversations
 * - recovery.openAmount      → recoveryService.listCases       → GET /recovery/cases
 * - contacts.total           → contactsService.listContacts    → GET /contacts
 * - charts.revenue           → salesService.getMetrics         → GET /sales/metrics
 * - queues.operations        → messagingService + recoveryService → computed
 */
export function DashboardWidgetRenderer({
  widget,
  metric,
}: {
  widget: DashboardWidget;
  metric?: DashboardMetricValue;
}) {
  // CHART and QUEUE widgets are rendered by dedicated page-level components
  if (widget.kind !== 'KPI') {
    return null;
  }

  const Icon = iconMap[widget.icon as keyof typeof iconMap] ?? Activity;

  return (
    <KPICard
      title={widget.title}
      value={formatMetricValue(widget, metric)}
      subtitle={metric?.helper ?? widget.subtitle ?? ''}
      icon={Icon}
    />
  );
}
