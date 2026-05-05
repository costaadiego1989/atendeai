const ROUTE_FEEDBACK_RULES: ReadonlyArray<{ prefix: string; code: string; label: string }> = [
  { prefix: '/app/settings/support', code: 'settings_support', label: 'Suporte' },
  { prefix: '/app/settings/integrations', code: 'settings_integrations', label: 'Integrações' },
  { prefix: '/app/settings/channels', code: 'settings_channels', label: 'Canais' },
  { prefix: '/app/settings/alerts', code: 'settings_alerts', label: 'Alertas' },
  { prefix: '/app/settings/company', code: 'settings_company', label: 'Dados da empresa' },
  { prefix: '/app/settings/ai', code: 'settings_ai', label: 'IA Comercial' },
  { prefix: '/app/platform/tenants', code: 'platform_admin', label: 'Plataforma admin' },
  { prefix: '/app/prospecting', code: 'prospecting', label: 'Prospecção' },
  { prefix: '/app/billing/usage', code: 'billing_usage', label: 'Uso / Billing' },
  { prefix: '/app/sales/metrics', code: 'sales_metrics', label: 'Métricas de vendas' },
  { prefix: '/app/sales/payment-links', code: 'sales_payment_links', label: 'Links de pagamento' },
  { prefix: '/app/sales/promotions', code: 'sales_promotions', label: 'Promoções e cupons' },
  { prefix: '/app/checkout', code: 'checkout', label: 'Checkout' },
  { prefix: '/app/inventory', code: 'inventory', label: 'Estoque' },
  { prefix: '/app/catalog', code: 'catalog', label: 'Catálogo' },
  { prefix: '/app/recovery', code: 'recovery', label: 'Cobranças' },
  { prefix: '/app/scheduling', code: 'scheduling', label: 'Agenda' },
  { prefix: '/app/conversations', code: 'messaging', label: 'Conversas' },
  { prefix: '/app/contacts', code: 'contacts', label: 'Contatos' },
  { prefix: '/app/social', code: 'social', label: 'Engajamento' },
  { prefix: '/app/dashboard', code: 'dashboard', label: 'Dashboard' },
  { prefix: '/app/team', code: 'team', label: 'Equipe' },
];

const SORTED_RULES = [...ROUTE_FEEDBACK_RULES].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export type FeedbackAppModuleCode = string;

export function resolveFeedbackAppModule(pathname: string): {
  code: FeedbackAppModuleCode;
  label: string;
} {
  const path = pathname || '';
  const hit = SORTED_RULES.find((rule) => path.startsWith(rule.prefix));
  if (hit) {
    return { code: hit.code, label: hit.label };
  }
  return { code: 'other', label: 'Outra área' };
}

export function feedbackModuleLabel(code: string | null | undefined): string {
  if (!code) return '—';
  const row = ROUTE_FEEDBACK_RULES.find((r) => r.code === code);
  return row?.label ?? code;
}
