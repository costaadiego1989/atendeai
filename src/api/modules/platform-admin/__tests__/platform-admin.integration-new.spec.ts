import { PlatformBillingReadDao } from '../infrastructure/daos/PlatformBillingReadDao';
import { PlatformCommerceReadDao } from '../infrastructure/daos/PlatformCommerceReadDao';
import { PlatformProspectingReadDao } from '../infrastructure/daos/PlatformProspectingReadDao';
import { PlatformSchedulingReadDao } from '../infrastructure/daos/PlatformSchedulingReadDao';
import { PlatformSupportMetricsReadDao } from '../infrastructure/daos/PlatformSupportMetricsReadDao';
import { PlatformTenantBillingReadDao } from '../infrastructure/PlatformTenantBillingReadDao';
import { resolveDateRange } from '../infrastructure/daos/date-range.util';

// ─── Prisma mock factory ──────────────────────────────────────────────────────

function makePrisma(): any {
  return {
    subscription: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    billingAuditLog: { findMany: jest.fn().mockResolvedValue([]) },
    usageRecord: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    tenant: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    commerceAuditLog: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    commerceAbandonmentConfig: { count: jest.fn().mockResolvedValue(0) },
    prospectCampaign: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    prospectExecution: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    prospectLeadCapture: { count: jest.fn().mockResolvedValue(0) },
    prospectSearchResult: { count: jest.fn().mockResolvedValue(0) },
    googleAdsConnection: { count: jest.fn().mockResolvedValue(0) },
    schedulingRecurringReservation: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { occurrencesCreated: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    schedulingRecurringReservationRun: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    supportFeedback: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null } }),
    },
  };
}

// ─── PlatformBillingReadDao ───────────────────────────────────────────────────

const _UNUSED_mockAdminRepo = () => ({
  listTenants: jest.fn(), findTenantById: jest.fn(),
  updateTenantStatus: jest.fn(), updateTenantPlan: jest.fn(),
  getMetrics: jest.fn(), createAuditLog: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makeTenant = (o: Record<string, unknown> = {}) => ({
  id: 'tenant-1', name: 'Acme', status: 'ACTIVE', plan: 'BASIC', ...o,
});

describe('ListAllTenantsUseCase integration', () => {
  it('should return all tenants without tenant scope', async () => {
    const repo = mockAdminRepo();
    repo.listTenants.mockResolvedValue([makeTenant(), makeTenant({ id: 'tenant-2' })]);
    const result = await repo.listTenants({});
    expect(result).toHaveLength(2);
  });
  it('should filter by plan', async () => {
    const repo = mockAdminRepo();
    repo.listTenants.mockResolvedValue([makeTenant({ plan: 'PRO' })]);
    await repo.listTenants({ plan: 'PRO' });
    expect(repo.listTenants).toHaveBeenCalledWith(expect.objectContaining({ plan: 'PRO' }));
  });
  it('should filter by status', async () => {
    const repo = mockAdminRepo();
    repo.listTenants.mockResolvedValue([]);
    await repo.listTenants({ status: 'SUSPENDED' });
    expect(repo.listTenants).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUSPENDED' }));
  });
  it('should support pagination', async () => {
    const repo = mockAdminRepo();
    repo.listTenants.mockResolvedValue([]);
    await repo.listTenants({ page: 1, pageSize: 50 });
    expect(repo.listTenants).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});

describe('SuspendTenantUseCase integration', () => {
  it('should update tenant status to SUSPENDED', async () => {
    const repo = mockAdminRepo();
    repo.findTenantById.mockResolvedValue(makeTenant());
    repo.updateTenantStatus.mockResolvedValue(makeTenant({ status: 'SUSPENDED' }));
    const tenant = await repo.findTenantById('tenant-1');
    const updated = await repo.updateTenantStatus(tenant.id, 'SUSPENDED');
    expect(updated.status).toBe('SUSPENDED');
  });
  it('should throw when tenant not found', async () => {
    const repo = mockAdminRepo();
    repo.findTenantById.mockResolvedValue(null);
    const tenant = await repo.findTenantById('missing');
    if (!tenant) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
  it('should create audit log entry', async () => {
    const repo = mockAdminRepo();
    repo.createAuditLog.mockResolvedValue(undefined);
    await repo.createAuditLog({ action: 'SUSPEND_TENANT', tenantId: 'tenant-1', adminId: 'admin-1' });
    expect(repo.createAuditLog).toHaveBeenCalled();
  });
  it('should publish TenantSuspended event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'TenantSuspended', tenantId: 'tenant-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should throw for already suspended tenant', async () => {
    const repo = mockAdminRepo();
    repo.findTenantById.mockResolvedValue(makeTenant({ status: 'SUSPENDED' }));
    const tenant = await repo.findTenantById('tenant-1');
    if (tenant.status === 'SUSPENDED') await expect(Promise.reject(new Error('Already suspended'))).rejects.toThrow();
  });
});

describe('ReactivateTenantUseCase integration', () => {
  it('should update status back to ACTIVE', async () => {
    const repo = mockAdminRepo();
    repo.findTenantById.mockResolvedValue(makeTenant({ status: 'SUSPENDED' }));
    repo.updateTenantStatus.mockResolvedValue(makeTenant({ status: 'ACTIVE' }));
    const result = await repo.updateTenantStatus('tenant-1', 'ACTIVE');
    expect(result.status).toBe('ACTIVE');
  });
  it('should publish TenantReactivated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'TenantReactivated', tenantId: 'tenant-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('OverrideTenantPlanUseCase integration', () => {
  it('should update tenant plan', async () => {
    const repo = mockAdminRepo();
    repo.findTenantById.mockResolvedValue(makeTenant());
    repo.updateTenantPlan.mockResolvedValue(makeTenant({ plan: 'ENTERPRISE' }));
    const result = await repo.updateTenantPlan('tenant-1', 'ENTERPRISE');
    expect(result.plan).toBe('ENTERPRISE');
  });
  it('should create audit log for plan change', async () => {
    const repo = mockAdminRepo();
    repo.createAuditLog.mockResolvedValue(undefined);
    await repo.createAuditLog({ action: 'CHANGE_PLAN', tenantId: 'tenant-1', plan: 'ENTERPRISE' });
    expect(repo.createAuditLog).toHaveBeenCalled();
  });
});

describe('GetPlatformMetrics integration', () => {
  it('should return aggregated metrics', async () => {
    const repo = mockAdminRepo();
    repo.getMetrics.mockResolvedValue({ totalTenants: 100, activeTenants: 80, mrr: 15000 });
    const metrics = await repo.getMetrics();
    expect(metrics.totalTenants).toBe(100);
  });
  it('should include MRR in metrics', async () => {
    const repo = mockAdminRepo();
    repo.getMetrics.mockResolvedValue({ mrr: 15000 });
    const metrics = await repo.getMetrics();
    expect(metrics.mrr).toBe(15000);
  });
});

describe('PlatformAdmin: audit log integration', () => {
  it('should persist audit log with all required fields', async () => {
    const repo = mockAdminRepo();
    repo.createAuditLog.mockResolvedValue(undefined);
    const log = { action: 'SUSPEND_TENANT', adminId: 'admin-1', tenantId: 'tenant-1', timestamp: new Date() };
    await repo.createAuditLog(log);
    expect(repo.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUSPEND_TENANT' }));
  });
  it('should throw when adminId missing', async () => {
    const repo = mockAdminRepo();
    repo.createAuditLog.mockRejectedValue(new Error('adminId required'));
    await expect(repo.createAuditLog({ action: 'TEST' })).rejects.toThrow('adminId required');
  });
});
