import { billingService } from '@/modules/billing/services/billing-service';
import { contactsService } from '@/modules/contacts/services/contacts-service';
import { messagingService } from '@/modules/messaging/services/messaging-service';
import { recoveryService } from '@/modules/recovery/services/RecoveryService';
import { salesService, type SalesMetricsSnapshot } from '@/modules/sales/services/sales-service';
import type {
  Contact,
  Conversation,
  RecoveryCase,
  SalesPaymentLink,
  Tenant,
  UsageData,
} from '@/shared/types';

export type DashboardRange = '7d' | '30d' | '90d';
export type DashboardWidgetKind = 'KPI' | 'CHART' | 'TABLE' | 'QUEUE' | 'ACTION';
export type DashboardLayoutProfile =
  | 'commerce'
  | 'scheduling'
  | 'recovery'
  | 'service'
  | 'default';

export interface DashboardWidget {
  id: string;
  moduleCode: string;
  nicheCodes?: string[];
  title: string;
  kind: DashboardWidgetKind;
  priority: number;
  queryKey: string;
  profileKeys?: DashboardLayoutProfile[];
  requiredPermissions?: string[];
  subtitle?: string;
  icon?: string;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  enabledModules: string[];
  hiddenModules: string[];
}

export interface DashboardMetricValue {
  value: number;
  label?: string;
  helper?: string;
}

export interface DashboardMetricsResponse {
  range: DashboardRange;
  snapshot: DashboardSnapshot;
  kpis: Record<string, DashboardMetricValue>;
  salesMetrics: SalesMetricsSnapshot;
  paymentSummary: DashboardSnapshot['paymentSummary'];
}

export interface DashboardSnapshot {
  usage: UsageData | null;
  salesMetrics: SalesMetricsSnapshot;
  contacts: Contact[];
  conversations: Conversation[];
  recoveryCases: RecoveryCase[];
  paymentLinks: SalesPaymentLink[];
  paymentSummary: {
    totalLinks: number;
    activeLinks: number;
    pausedLinks: number;
    paidLinks: number;
    expiredLinks: number;
    estimatedRevenue: number;
    paidRevenue: number;
  };
  unavailableModules: string[];
}

function formatDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildRange(range: DashboardRange) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(
    endDate.getDate() - (range === '7d' ? 6 : range === '30d' ? 29 : 89),
  );

  return {
    startDate: formatDateParam(startDate),
    endDate: formatDateParam(endDate),
  };
}

const defaultDashboardWidgets: DashboardWidget[] = [
  {
    id: 'sales-estimated-revenue',
    moduleCode: 'CHECKOUT_WA',
    title: 'Receita estimada',
    kind: 'KPI',
    priority: 10,
    queryKey: 'sales.totalRevenue',
    profileKeys: ['commerce', 'scheduling', 'service', 'default'],
    subtitle: 'Checkouts emitidos no periodo',
    icon: 'CreditCard',
  },
  {
    id: 'sales-paid-revenue',
    moduleCode: 'CHECKOUT_WA',
    title: 'Pagamentos confirmados',
    kind: 'KPI',
    priority: 20,
    queryKey: 'payments.paidRevenue',
    profileKeys: ['commerce', 'recovery', 'default'],
    subtitle: 'Receita efetivamente capturada',
    icon: 'Wallet',
  },
  {
    id: 'commerce-open-checkouts',
    moduleCode: 'CHECKOUT_WA',
    nicheCodes: ['FOOD', 'RETAIL', 'ECOMMERCE', 'MARKET', 'GROCERY', 'BAKERY', 'CAFETERIA'],
    title: 'Pedidos em aberto',
    kind: 'KPI',
    priority: 30,
    queryKey: 'payments.activeLinks',
    profileKeys: ['commerce'],
    subtitle: 'Links e checkouts aguardando conversao',
    icon: 'ShoppingCart',
  },
  {
    id: 'messaging-human-queue',
    moduleCode: 'TRIAGEM_IA',
    title: 'Atendimento humano',
    kind: 'KPI',
    priority: 40,
    queryKey: 'conversations.waitingHuman',
    profileKeys: ['commerce', 'scheduling', 'recovery', 'service', 'default'],
    subtitle: 'Conversas esperando o time',
    icon: 'MessageSquareText',
  },
  {
    id: 'recovery-open-amount',
    moduleCode: 'Cobran\u00e7a_AUTO',
    title: 'Carteira em aberto',
    kind: 'KPI',
    priority: 50,
    queryKey: 'recovery.openAmount',
    profileKeys: ['recovery'],
    subtitle: 'Casos que pedem acompanhamento',
    icon: 'Siren',
  },
  {
    id: 'contacts-total',
    moduleCode: 'QUALIFICACAO_IA',
    title: 'Novos contatos',
    kind: 'KPI',
    priority: 60,
    queryKey: 'contacts.total',
    profileKeys: ['scheduling', 'service', 'default'],
    subtitle: 'Leads e clientes no CRM',
    icon: 'Contact2',
  },
  {
    id: 'sales-revenue-chart',
    moduleCode: 'CHECKOUT_WA',
    title: 'Receita por periodo',
    kind: 'CHART',
    priority: 100,
    queryKey: 'charts.revenue',
    profileKeys: ['commerce', 'scheduling', 'service', 'default'],
  },
  {
    id: 'operations-queue',
    moduleCode: 'TEAM_ROUTING',
    title: 'Fila operacional',
    kind: 'QUEUE',
    priority: 200,
    queryKey: 'queues.operations',
    profileKeys: ['commerce', 'scheduling', 'recovery', 'service', 'default'],
  },
];

function normalizeModuleCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeBusinessType(value?: string | null) {
  return value?.trim().toUpperCase();
}

const commerceBusinessTypes = new Set([
  'FOOD',
  'RETAIL',
  'ECOMMERCE',
  'MARKET',
  'GROCERY',
  'BAKERY',
  'CAFETERIA',
  'SUPERMARKET',
]);

const schedulingBusinessTypes = new Set([
  'HEALTH',
  'BEAUTY',
  'GYM',
  'PET',
  'SCHEDULING',
  'CLINIC',
]);

const serviceBusinessTypes = new Set([
  'AGENCY',
  'AUTOMOTIVE',
  'EDUCATION',
  'HOME_SERV',
  'HOSPITALITY',
  'LEGAL',
  'REALESTATE',
  'RENTAL',
  'SIMPLE_SERVICE',
]);

const moduleAliases: Record<string, string[]> = {
  CHECKOUT_WA: [
    'CHECKOUT_WA',
    'CHECKOUT_CONVERSATIONAL',
    'ABANDONED_CART',
    'DELIVERY_SHIPPING',
    'COUPONS_PROMOTIONS',
  ],
  ESTOQUE_IA: ['ESTOQUE_IA', 'CATALOG_INVENTORY'],
  AGENDAMENTO_ONLINE: [
    'AGENDAMENTO_ONLINE',
    'SCHEDULING_PRO',
    'GOOGLE_CALENDAR_MEET',
    'SCHEDULING_REMINDERS',
    'PREPAID_BOOKING',
  ],
  'Cobrança_AUTO': [
    'COBRANÇA_AUTO',
    'COBRANCA_AUTO',
    'RECOVERY_WALLET',
    'RECOVERY_AUTOMATION',
    'RECOVERY_REPORTS',
  ],
  TRIAGEM_IA: ['TRIAGEM_IA', 'INBOX', 'AI_ASSISTANT'],
  QUALIFICACAO_IA: ['QUALIFICACAO_IA', 'LEAD_QUALIFICATION', 'CRM'],
  PROSPECCAO_ATIVA: ['PROSPECCAO_ATIVA', 'PROSPECTING_ENGINE'],
  TEAM_ROUTING: ['TEAM_ROUTING', 'TEAM_ROUTING_BASE', 'INBOX'],
};

function resolveLayoutProfile(tenant?: Tenant | null): DashboardLayoutProfile {
  const businessType = normalizeBusinessType(tenant?.businessType);
  const enabledModules = getEnabledModuleSet(tenant);

  if (businessType && commerceBusinessTypes.has(businessType)) {
    return 'commerce';
  }

  if (businessType && schedulingBusinessTypes.has(businessType)) {
    return 'scheduling';
  }

  if (businessType === 'RECOVERY') {
    return 'recovery';
  }

  if (businessType && serviceBusinessTypes.has(businessType)) {
    return 'service';
  }

  if (hasAnyModule(enabledModules, 'CHECKOUT_WA') || hasAnyModule(enabledModules, 'ESTOQUE_IA')) {
    return 'commerce';
  }

  if (hasAnyModule(enabledModules, 'AGENDAMENTO_ONLINE')) {
    return 'scheduling';
  }

  if (hasAnyModule(enabledModules, 'Cobrança_AUTO')) {
    return 'recovery';
  }

  if (hasAnyModule(enabledModules, 'TRIAGEM_IA') || hasAnyModule(enabledModules, 'QUALIFICACAO_IA')) {
    return 'service';
  }

  return 'default';
}

const widgetPriorityByProfile: Record<string, Record<string, number>> = {
  commerce: {
    'sales-estimated-revenue': 10,
    'sales-paid-revenue': 20,
    'commerce-open-checkouts': 30,
    'messaging-human-queue': 40,
  },
  scheduling: {
    'messaging-human-queue': 10,
    'contacts-total': 20,
    'sales-estimated-revenue': 30,
    'recovery-open-amount': 40,
  },
  recovery: {
    'recovery-open-amount': 10,
    'sales-paid-revenue': 20,
    'messaging-human-queue': 30,
    'commerce-open-checkouts': 40,
  },
  service: {
    'contacts-total': 10,
    'messaging-human-queue': 20,
    'sales-estimated-revenue': 30,
    'sales-paid-revenue': 40,
  },
};

function getWidgetPriority(widget: DashboardWidget, tenant?: Tenant | null) {
  const profile = resolveLayoutProfile(tenant);
  return widgetPriorityByProfile[profile]?.[widget.id] ?? widget.priority + 100;
}

function getEnabledModuleSet(tenant?: Tenant | null) {
  const enabledModules = tenant?.billingAccess?.enabledModules ?? [];
  return new Set(enabledModules.map(normalizeModuleCode));
}

function getModuleAliases(moduleCode: string) {
  const normalized = normalizeModuleCode(moduleCode);
  const aliases = moduleAliases[moduleCode] ?? moduleAliases[normalized] ?? [moduleCode];
  return aliases.map(normalizeModuleCode);
}

function hasAnyModule(enabledModules: Set<string>, moduleCode: string) {
  return getModuleAliases(moduleCode).some((code) => enabledModules.has(code));
}

function hasExplicitModuleAccess(tenant?: Tenant | null) {
  return Boolean(tenant?.billingAccess && tenant.billingAccess.enabledModules.length > 0);
}

function isWidgetEnabled(widget: DashboardWidget, tenant?: Tenant | null) {
  const profile = resolveLayoutProfile(tenant);
  const isProfileWidget =
    !widget.profileKeys || widget.profileKeys.includes(profile) || profile === 'default';

  if (!isProfileWidget) {
    return false;
  }

  if (profile === 'commerce' && widget.moduleCode === 'Cobrança_AUTO') {
    return false;
  }

  if (!hasExplicitModuleAccess(tenant)) {
    return widgetPriorityByProfile[profile]?.[widget.id] !== undefined || profile === 'default';
  }

  const enabledModules = getEnabledModuleSet(tenant);
  return hasAnyModule(enabledModules, widget.moduleCode);
}

export function composeDashboardLayout(tenant?: Tenant | null): DashboardLayout {
  const widgets = defaultDashboardWidgets
    .filter((widget) => isWidgetEnabled(widget, tenant))
    .sort((left, right) => getWidgetPriority(left, tenant) - getWidgetPriority(right, tenant));
  const enabledModules = tenant?.billingAccess?.enabledModules ?? [];
  const hiddenModules = defaultDashboardWidgets
    .filter((widget) => !widgets.some((visible) => visible.id === widget.id))
    .map((widget) => widget.moduleCode);

  return {
    widgets,
    enabledModules,
    hiddenModules: Array.from(new Set(hiddenModules)),
  };
}

function emptySalesMetrics(): SalesMetricsSnapshot {
  return {
    metrics: [],
    summary: {
      totalMessages: 0,
      totalIntents: 0,
      totalLinks: 0,
      totalRevenue: 0,
    },
  };
}

function emptyPaymentSummary() {
  return {
    totalLinks: 0,
    activeLinks: 0,
    pausedLinks: 0,
    paidLinks: 0,
    expiredLinks: 0,
    estimatedRevenue: 0,
    paidRevenue: 0,
  };
}

export const dashboardService = {
  async getLayout(tenant?: Tenant | null): Promise<DashboardLayout> {
    return composeDashboardLayout(tenant);
  },

  async getMetrics(
    tenantId: string,
    range: DashboardRange,
    branchId?: string | null,
  ): Promise<DashboardMetricsResponse> {
    const snapshot = await this.getSnapshot(tenantId, range, branchId);
    const waitingHuman = snapshot.conversations.filter(
      (conversation) => conversation.status === 'PENDING_HUMAN',
    ).length;
    const openRecoveryCases = snapshot.recoveryCases.filter(
      (item) => item.status !== 'PAID' && item.status !== 'STOPPED',
    );
    const openRecoveryAmount = openRecoveryCases.reduce(
      (total, item) => total + (item.amountDue ?? 0),
      0,
    );

    return {
      range,
      snapshot,
      salesMetrics: snapshot.salesMetrics,
      paymentSummary: snapshot.paymentSummary,
      kpis: {
        'sales.totalRevenue': {
          value: snapshot.paymentSummary.estimatedRevenue,
          helper: `${snapshot.paymentSummary.totalLinks} checkouts emitidos`,
        },
        'payments.paidRevenue': {
          value: snapshot.paymentSummary.paidRevenue,
          helper: `${snapshot.paymentSummary.paidLinks} pagamentos confirmados`,
        },
        'payments.activeLinks': {
          value: snapshot.paymentSummary.activeLinks,
          helper: `${snapshot.paymentSummary.totalLinks} checkouts no periodo`,
        },
        'conversations.waitingHuman': {
          value: waitingHuman,
          helper: `${snapshot.conversations.length} conversas monitoradas`,
        },
        'recovery.openAmount': {
          value: openRecoveryAmount,
          helper: `${openRecoveryCases.length} casos abertos`,
        },
        'contacts.total': {
          value: snapshot.contacts.length,
          helper: 'Contatos carregados para o radar',
        },
      },
    };
  },

  async getSnapshot(
    tenantId: string,
    range: DashboardRange,
    branchId?: string | null,
  ): Promise<DashboardSnapshot> {
    const { startDate, endDate } = buildRange(range);

    const [
      usageResult,
      salesMetricsResult,
      contactsResult,
      conversationsResult,
      recoveryResult,
      paymentLinksResult,
    ] = await Promise.allSettled([
      billingService.getUsage(tenantId),
      salesService.getMetrics(startDate, endDate, branchId),
      contactsService.listContacts(tenantId, { page: 1, limit: 200, branchId }),
      messagingService.listConversations(tenantId, { page: 1, limit: 100, branchId }),
      recoveryService.listCases(tenantId, { branchId: branchId ?? undefined }),
      salesService.listPaymentLinks({ page: 1, pageSize: 5, branchId }),
    ]);

    const unavailableModules: string[] = [];

    if (usageResult.status === 'rejected') unavailableModules.push('Uso do plano');
    if (salesMetricsResult.status === 'rejected') unavailableModules.push('Vendas');
    if (contactsResult.status === 'rejected') unavailableModules.push('CRM');
    if (conversationsResult.status === 'rejected') unavailableModules.push('Conversas');
    if (recoveryResult.status === 'rejected') unavailableModules.push('cobrança');
    if (paymentLinksResult.status === 'rejected') unavailableModules.push('Checkout');

    return {
      usage: usageResult.status === 'fulfilled' ? usageResult.value : null,
      salesMetrics:
        salesMetricsResult.status === 'fulfilled'
          ? salesMetricsResult.value
          : emptySalesMetrics(),
      contacts:
        contactsResult.status === 'fulfilled' ? contactsResult.value.data : [],
      conversations:
        conversationsResult.status === 'fulfilled'
          ? conversationsResult.value.data
          : [],
      recoveryCases:
        recoveryResult.status === 'fulfilled' ? recoveryResult.value : [],
      paymentLinks:
        paymentLinksResult.status === 'fulfilled'
          ? paymentLinksResult.value.items
          : [],
      paymentSummary:
        paymentLinksResult.status === 'fulfilled'
          ? paymentLinksResult.value.summary
          : emptyPaymentSummary(),
      unavailableModules,
    };
  },
};
