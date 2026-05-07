import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  composeDashboardLayout,
  dashboardService,
  type DashboardMetricValue,
  type DashboardRange,
} from '@/modules/dashboard/services/dashboard-service';
import { buildCommercialRevenueSnapshot } from '@/shared/commercial/commercial-metrics';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  buildScopedTenantData,
  getTenantCompleteness,
} from '@/modules/settings/components/tenant/tenant-view-helpers';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { resolveDashboardProfile } from '@/modules/dashboard/view-models/dashboard-profile';

function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function sortByNewest<T extends { createdAt?: string; lastMessageAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.lastMessageAt ?? left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.lastMessageAt ?? right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

export function useDashboardPageViewModel() {
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [range, setRange] = useState<DashboardRange>('7d');

  const snapshotQuery = useQuery({
    queryKey: ['dashboard-snapshot', tenant?.id, activeBranchId, range],
    enabled: Boolean(tenant?.id),
    queryFn: () => dashboardService.getSnapshot(tenant!.id, range, activeBranchId),
  });

  const tenantSettingsQuery = useQuery({
    queryKey: ['tenant-settings-dashboard', tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: () => (tenant?.id ? companySettingsService.getTenantSettings(tenant.id) : null),
  });

  const isLoading =
    (snapshotQuery.isLoading && !snapshotQuery.data) ||
    (tenantSettingsQuery.isLoading && !tenantSettingsQuery.data);

  const derived = useMemo(() => {
    const snapshot = snapshotQuery.data;
    const fullTenant = tenantSettingsQuery.data || tenant;

    const conversations = snapshot?.conversations ?? [];
    const contacts = snapshot?.contacts ?? [];
    const recoveryCases = snapshot?.recoveryCases ?? [];
    const usage = snapshot?.usage;
    const salesMetrics = snapshot?.salesMetrics;
    const paymentSummary = snapshot?.paymentSummary;
    const commercialRevenue = buildCommercialRevenueSnapshot(paymentSummary, recoveryCases);

    const waitingHumanCount = conversations.filter(
      (conversation) => conversation.status === 'PENDING_HUMAN',
    ).length;
    const activeConversationCount = conversations.filter(
      (conversation) =>
        conversation.status === 'ACTIVE' || conversation.status === 'PENDING_HUMAN',
    ).length;

    const openRecoveryCases = recoveryCases.filter(
      (item) => item.status !== 'PAID' && item.status !== 'STOPPED',
    );
    const openRecoveryAmount = openRecoveryCases.reduce(
      (total, item) => total + (item.amountDue ?? 0),
      0,
    );

    const stageMap = new Map<string, number>([
      ['LEAD', 0],
      ['PROSPECT', 0],
      ['OPPORTUNITY', 0],
      ['CUSTOMER', 0],
      ['INACTIVE', 0],
    ]);
    contacts.forEach((contact) => {
      stageMap.set(contact.stage, (stageMap.get(contact.stage) ?? 0) + 1);
    });

    const recoveryStatusMap = new Map<string, number>([
      ['READY_TO_CONTACT', 0],
      ['CONTACTED', 0],
      ['NEGOTIATING', 0],
      ['PROMISE_TO_PAY', 0],
      ['NO_RESPONSE', 0],
      ['PAID', 0],
    ]);
    recoveryCases.forEach((item) => {
      if (recoveryStatusMap.has(item.status)) {
        recoveryStatusMap.set(item.status, (recoveryStatusMap.get(item.status) ?? 0) + 1);
      }
    });

    const revenueSeries =
      salesMetrics?.metrics?.map((metric) => ({
        date: formatCompactDate(metric.date),
        receita: metric.estimatedRevenue,
        intents: metric.purchaseIntents,
        links: metric.paymentLinksGenerated,
        mensagens: metric.totalMessages,
      })) ?? [];

    const pipelineSeries = Array.from(stageMap.entries()).map(([stage, total]) => ({
      stage,
      total,
    }));

    const recoverySeries = Array.from(recoveryStatusMap.entries())
      .map(([status, total]) => ({ status, total }))
      .filter((item) => item.total > 0);

    const emptySalesSummary = {
      totalMessages: 0,
      totalIntents: 0,
      totalLinks: 0,
      totalRevenue: 0,
    };
    const scopedSalesSummary = {
      ...emptySalesSummary,
      totalMessages: conversations.length,
      totalIntents: paymentSummary?.activeLinks ?? 0,
      totalLinks: paymentSummary?.totalLinks ?? 0,
      totalRevenue: paymentSummary?.estimatedRevenue ?? 0,
    };

    const usageSeries = usage
      ? [
          {
            id: 'messages',
            label: 'Mensagens',
            used: usage.messages.used,
            quota: usage.messages.quota,
            percentage:
              usage.messages.quota > 0
                ? Math.min(100, (usage.messages.used / usage.messages.quota) * 100)
                : 0,
          },
          {
            id: 'aiTokens',
            label: 'Tokens IA',
            used: usage.aiTokens.used,
            quota: usage.aiTokens.quota,
            percentage:
              usage.aiTokens.quota > 0
                ? Math.min(100, (usage.aiTokens.used / usage.aiTokens.quota) * 100)
                : 0,
          },
          {
            id: 'contacts',
            label: 'Contatos',
            used: usage.contacts.used,
            quota: usage.contacts.quota,
            percentage:
              usage.contacts.quota > 0
                ? Math.min(100, (usage.contacts.used / usage.contacts.quota) * 100)
                : 0,
          },
        ]
      : [];

    const recentConversations = sortByNewest(conversations).slice(0, 5);
    const recentCharges = sortByNewest(snapshot?.paymentLinks ?? []).slice(0, 4);
    const recoveryPriorities = sortByNewest(
      openRecoveryCases.filter(
        (item) =>
          item.status === 'PROMISE_TO_PAY' ||
          item.status === 'NEGOTIATING' ||
          item.status === 'READY_TO_CONTACT',
      ),
    ).slice(0, 4);
    const intelligenceItems = conversations
      .map((conversation) => conversation.intelligence)
      .filter(Boolean);
    const sentimentSummary = {
      positive: intelligenceItems.filter((item) => item?.sentiment === 'POSITIVE').length,
      neutral: intelligenceItems.filter((item) => item?.sentiment === 'NEUTRAL').length,
      negative: intelligenceItems.filter((item) => item?.sentiment === 'NEGATIVE').length,
    };
    const tagMap = new Map<string, number>();
    intelligenceItems.forEach((item) => {
      item?.tags?.forEach((tag) => {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      });
    });
    const topConversationTags = Array.from(tagMap.entries())
      .map(([tag, total]) => ({ tag, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);

    const activeBranch = activeBranchId
      ? (fullTenant?.branches ?? []).find((b) => b.id === activeBranchId) ?? null
      : null;
    const displayTenant = buildScopedTenantData(fullTenant ?? undefined, activeBranch);
    const dashboardProfile = resolveDashboardProfile(fullTenant ?? tenant);
    const modularLayout = composeDashboardLayout(fullTenant ?? tenant);

    const tenantCompleteness = getTenantCompleteness(displayTenant, fullTenant?.owner);
    const launchChecklist = tenantCompleteness.items.map((item) => ({
      ...item,
      route:
        item.id === 'channels'
          ? '/app/settings/channels'
          : item.id === 'ai'
            ? '/app/settings/ai'
            : '/app/settings/company',
    }));

    const waitingHumanKpi = {
      value: waitingHumanCount,
      helper: `${activeConversationCount} conversas abertas agora`,
    };
    const openRecoveryAmountKpi = {
      value: openRecoveryAmount,
      helper: `${openRecoveryCases.length} casos abertos`,
    };
    const widgetMetrics: Record<string, DashboardMetricValue> = {
      'sales.totalRevenue': {
        value: scopedSalesSummary.totalRevenue,
        helper: `${scopedSalesSummary.totalLinks} checkouts emitidos`,
      },
      'payments.paidRevenue': {
        value: paymentSummary?.paidRevenue ?? 0,
        helper: `${paymentSummary?.paidLinks ?? 0} pagamentos confirmados`,
      },
      'payments.newSaleRevenue': {
        value: commercialRevenue.newSaleRevenue,
        helper: `${commercialRevenue.newSalePaymentsCount} vendas pagas`,
      },
      'payments.recoveredRevenue': {
        value: commercialRevenue.recoveredRevenue,
        helper: `${commercialRevenue.recoveredPaymentsCount} pagamentos de recovery`,
      },
      'payments.activeLinks': {
        value: paymentSummary?.activeLinks ?? 0,
        helper: `${paymentSummary?.totalLinks ?? 0} checkouts no periodo`,
      },
      'conversations.waitingHuman': waitingHumanKpi,
      'recovery.openAmount': openRecoveryAmountKpi,
      'contacts.total': {
        value: contacts.length,
        helper: 'Leads e clientes no CRM',
      },
    };
    return {
      waitingHumanCount,
      activeConversationCount,
      openRecoveryAmount,
      openRecoveryCount: openRecoveryCases.length,
      totalContacts: contacts.length,
      revenueSeries,
      pipelineSeries,
      recoverySeries,
      usageSeries,
      recentConversations,
      recentCharges,
      recoveryPriorities,
      launchChecklist,
      launchProgress: tenantCompleteness,
      operationReports: {
        conversationsWithIntelligence: intelligenceItems.length,
        sentimentSummary,
        topConversationTags,
        handoffQueue: waitingHumanCount,
        openRecoveryCount: openRecoveryCases.length,
        checkoutPaidRate:
          paymentSummary && paymentSummary.totalLinks > 0
            ? Math.round((paymentSummary.paidLinks / paymentSummary.totalLinks) * 100)
            : 0,
      },
      salesSummary: scopedSalesSummary,
      paymentSummary: paymentSummary ?? {
        totalLinks: 0,
        activeLinks: 0,
        pausedLinks: 0,
        paidLinks: 0,
        expiredLinks: 0,
        estimatedRevenue: 0,
        paidRevenue: 0,
      },
      commercialRevenue,
      billingCycle: usage?.billingCycle,
      plan: usage?.plan,
      unavailableModules: snapshot?.unavailableModules ?? [],
      dashboardProfile,
      dashboardLayout: modularLayout,
      widgetMetrics,
    };
  }, [snapshotQuery.data, tenantSettingsQuery.data, tenant, activeBranchId]);

  return {
    user,
    tenant,
    range,
    setRange,
    snapshotQuery,
    isLoading,
    ...derived,
  };
}

export type DashboardPageViewModel = ReturnType<typeof useDashboardPageViewModel>;
