import { describe, expect, it } from 'vitest';
import { composeDashboardLayout } from './dashboard-service';
import type { Tenant } from '@/shared/types';

function makeTenant(enabledModules: string[], businessType?: string): Tenant {
  return {
    id: 'tenant-1',
    name: 'Tenant teste',
    businessType,
    billingAccess: {
      subscriptionId: 'subscription-1',
      plan: 'PRO',
      status: 'ACTIVE',
      pricing: {
        baseMonthlyPrice: 0,
        addonsMonthlyPrice: 0,
        totalMonthlyPrice: 0,
      },
      includedModules: [],
      addonModules: [],
      enabledModules,
      moduleAccess: Object.fromEntries(enabledModules.map((code) => [code, true])),
    },
  };
}

describe('composeDashboardLayout', () => {
  it('keeps checkout widgets for a tenant with checkout access', () => {
    const layout = composeDashboardLayout(makeTenant(['CHECKOUT_WA']));

    expect(layout.widgets.map((widget) => widget.id)).toContain('sales-estimated-revenue');
    expect(layout.widgets.map((widget) => widget.id)).toContain('sales-new-sale-revenue');
    expect(layout.widgets.every((widget) => widget.moduleCode === 'CHECKOUT_WA')).toBe(true);
  });

  it('uses the local adapter defaults when access summary is not available yet', () => {
    const layout = composeDashboardLayout({
      id: 'tenant-2',
      name: 'Tenant sem resumo',
    });

    expect(layout.widgets.length).toBeGreaterThan(0);
    expect(layout.hiddenModules).toEqual([]);
  });

  it('prioritizes scheduling metrics for a scheduling niche without explicit module summary', () => {
    const layout = composeDashboardLayout({
      id: 'tenant-3',
      name: 'Clinica teste',
      businessType: 'HEALTH',
    });

    expect(layout.widgets.slice(0, 2).map((widget) => widget.id)).toEqual([
      'messaging-human-queue',
      'contacts-total',
    ]);
  });

  it('does not show recovery billing widgets for checkout niches without explicit access', () => {
    const layout = composeDashboardLayout({
      id: 'tenant-4',
      name: 'Loja teste',
      businessType: 'ECOMMERCE',
    });

    expect(layout.widgets.map((widget) => widget.id)).toContain('commerce-open-checkouts');
    expect(layout.widgets.map((widget) => widget.id)).not.toContain('recovery-open-amount');
  });

  it('keeps ecommerce focused on commerce metrics even when the plan includes recovery addons', () => {
    const layout = composeDashboardLayout(
      makeTenant(
        ['CHECKOUT_CONVERSATIONAL', 'ABANDONED_CART', 'RECOVERY_WALLET', 'INBOX'],
        'ECOMMERCE',
      ),
    );

    expect(
      layout.widgets.filter((widget) => widget.kind === 'KPI').map((widget) => widget.id),
    ).toEqual([
      'sales-estimated-revenue',
      'sales-new-sale-revenue',
      'commerce-open-checkouts',
      'messaging-human-queue',
    ]);
    expect(layout.widgets.map((widget) => widget.id)).not.toContain('recovery-open-amount');
  });

  it('maps billing catalog scheduling modules to scheduling metrics', () => {
    const layout = composeDashboardLayout(
      makeTenant(['SCHEDULING_PRO', 'SCHEDULING_REMINDERS', 'CRM', 'INBOX'], 'HEALTH'),
    );

    expect(layout.widgets.slice(0, 2).map((widget) => widget.id)).toEqual([
      'messaging-human-queue',
      'contacts-total',
    ]);
    expect(layout.widgets.map((widget) => widget.id)).not.toContain('recovery-open-amount');
  });
});
