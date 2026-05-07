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

export function DashboardWidgetRenderer({
  widget,
  metric,
}: {
  widget: DashboardWidget;
  metric?: DashboardMetricValue;
}) {
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
