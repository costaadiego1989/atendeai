import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantId } from '@shared/domain/TenantId';
import { Subscription } from '@modules/billing/domain/entities/Subscription';
import { Quotas } from '@modules/billing/domain/value-objects/Quotas';
import { AdjustTenantSubscriptionQuotasUseCase } from '../application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from '../application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from '../application/use-cases/SendTenantManualWhatsAppUseCase';
import { ListPlatformTenantsOverviewUseCase } from '../application/use-cases/ListPlatformTenantsOverviewUseCase';
import { GetPlatformTenantDetailUseCase } from '../application/use-cases/metrics/GetPlatformTenantsMetricsUseCase';
import { PlatformAdminApiKeyGuard } from '../presentation/guards/PlatformAdminApiKeyGuard';
import { resolveDateRange } from '../infrastructure/daos/date-range.util';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Factories ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-4000-8000-000000000099';

function makeSub(overrides: Partial<{ messages: number; aiTokens: number; contacts: number }> = {}) {
  return Subscription.create(TenantId.create(TENANT_ID), 'TRIAL', {
    quotas: Quotas.reconstitute(
      overrides.messages ?? 100,
      overrides.aiTokens ?? 500,
      overrides.contacts ?? 200,
    ),
  });
}

function makeBilling(subOverride?: ReturnType<typeof makeSub> | null) {
  return {
    findSubscription: jest.fn().mockResolvedValue(subOverride === undefined ? makeSub() : subOverride),
    saveSubscription: jest.fn().mockResolvedValue(undefined),
    saveAuditLog: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAI(text = 'draft result') {
  return { generateResponse: jest.fn().mockResolvedValue({ text }) };
}

function makeUsers(owner: { name: string; phone: string } | null = { name: 'Owner', phone: '+5511999990000' }) {
  return { findOwnerPrincipalByTenantId: jest.fn().mockResolvedValue(owner) };
}

function makeContacts(contactId = 'contact-1') {
  return { ensureContact: jest.fn().mockResolvedValue({ contactId }) };
}

function makeMessaging(result = { queued: true }) {
  return { queueSystemMessage: jest.fn().mockResolvedValue(result) };
}

function mockGuardCtx(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as ExecutionContext;
}

// ─── AdjustTenantSubscriptionQuotasUseCase ────────────────────────────────────

describe('AdjustTenantSubscriptionQuotasUseCase — error paths', () => {
  it('throws NotFoundException when subscription is null', async () => {
    const billing = makeBilling(null);
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await expect(uc.execute({ tenantId: TENANT_ID, messages: 10 }))
      .rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException with message "Subscription not found for tenant"', async () => {
    const billing = makeBilling(null);
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await expect(uc.execute({ tenantId: TENANT_ID }))
      .rejects.toThrow('Subscription not found for tenant');
  });

  it('does not call saveSubscription when subscription is not found', async () => {
    const billing = makeBilling(null);
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await expect(uc.execute({ tenantId: TENANT_ID })).rejects.toThrow(NotFoundException);
    expect(billing.saveSubscription).not.toHaveBeenCalled();
  });
});

describe('AdjustTenantSubscriptionQuotasUseCase — audit metadata', () => {
  it('saves audit log with event PLATFORM_QUOTA_ADJUST', async () => {
    const billing = makeBilling();
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({ tenantId: TENANT_ID, messages: 50 });
    expect(billing.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'PLATFORM_QUOTA_ADJUST', tenantId: TENANT_ID }),
    );
  });

  it('defaults undefined deltas to 0 in audit metadata', async () => {
    const billing = makeBilling();
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({ tenantId: TENANT_ID, messages: 5 });
    expect(billing.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          deltas: expect.objectContaining({ aiTokens: 0, contacts: 0 }),
        }),
      }),
    );
  });

  it('records the provided delta values in audit metadata', async () => {
    const billing = makeBilling();
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({ tenantId: TENANT_ID, messages: 10, aiTokens: 20, contacts: 30 });
    expect(billing.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          deltas: { messages: 10, aiTokens: 20, contacts: 30 },
        }),
      }),
    );
  });

  it('all three deltas are 0 when no fields provided', async () => {
    const billing = makeBilling();
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({ tenantId: TENANT_ID });
    expect(billing.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          deltas: { messages: 0, aiTokens: 0, contacts: 0 },
        }),
      }),
    );
  });

  it('returns tenantId and quotas shape', async () => {
    const billing = makeBilling();
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    const result = await uc.execute({ tenantId: TENANT_ID, messages: 5 });
    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      quotas: expect.objectContaining({ messages: expect.any(Number) }),
    });
  });

  it('calls saveSubscription before saveAuditLog', async () => {
    const callOrder: string[] = [];
    const billing = makeBilling();
    billing.saveSubscription.mockImplementation(async () => { callOrder.push('save'); });
    billing.saveAuditLog.mockImplementation(async () => { callOrder.push('audit'); });
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({ tenantId: TENANT_ID, messages: 1 });
    expect(callOrder).toEqual(['save', 'audit']);
  });
});

// ─── DraftTenantAdminMessageUseCase ───────────────────────────────────────────

describe('DraftTenantAdminMessageUseCase — happy paths', () => {
  it('trims whitespace from AI response', async () => {
    const uc = new DraftTenantAdminMessageUseCase(makeAI('  hello  ') as any);
    const r = await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'summary' });
    expect(r.text).toBe('hello');
  });

  it('returns text from AI for QUOTA_WARNING intent', async () => {
    const uc = new DraftTenantAdminMessageUseCase(makeAI('quota msg') as any);
    const r = await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'ctx' });
    expect(r.text).toBe('quota msg');
  });

  it('uses operatorHint in CUSTOM intent user message', async () => {
    const ai = makeAI('custom response');
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'CUSTOM', locale: 'pt-BR', tenantSummary: 'ctx', operatorHint: 'be friendly' });
    const call = ai.generateResponse.mock.calls[0][0];
    expect(call.userMessage).toContain('be friendly');
  });

  it('uses empty string when operatorHint is undefined for CUSTOM intent', async () => {
    const ai = makeAI('ok');
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'CUSTOM', locale: 'pt-BR', tenantSummary: 'ctx' });
    const call = ai.generateResponse.mock.calls[0][0];
    expect(call.userMessage).toContain('Operator instruction: ');
  });

  it('passes maxTokens=400 and temperature=0.4 to AI', async () => {
    const ai = makeAI();
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'ctx' });
    expect(ai.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 400, temperature: 0.4 }),
    );
  });

  it('passes empty contextHistory to AI', async () => {
    const ai = makeAI();
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'ctx' });
    expect(ai.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({ contextHistory: [] }),
    );
  });

  it('system prompt instructs no markdown', async () => {
    const ai = makeAI();
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'ctx' });
    const call = ai.generateResponse.mock.calls[0][0];
    expect(call.systemPrompt).toContain('No markdown');
  });

  it('QUOTA_WARNING user message contains "quota alert" instruction', async () => {
    const ai = makeAI();
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'tenant info' });
    const call = ai.generateResponse.mock.calls[0][0];
    expect(call.userMessage).toContain('quota alert');
  });
});

describe('DraftTenantAdminMessageUseCase — error propagation', () => {
  it('propagates AI error without catching', async () => {
    const ai = { generateResponse: jest.fn().mockRejectedValue(new Error('AI down')) };
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await expect(uc.execute({ intent: 'CUSTOM', locale: 'pt-BR', tenantSummary: 'ctx' }))
      .rejects.toThrow('AI down');
  });

  it('propagates network timeout from AI', async () => {
    const ai = { generateResponse: jest.fn().mockRejectedValue(new Error('timeout')) };
    const uc = new DraftTenantAdminMessageUseCase(ai as any);
    await expect(uc.execute({ intent: 'QUOTA_WARNING', locale: 'pt-BR', tenantSummary: 'ctx' }))
      .rejects.toThrow('timeout');
  });
});

// ─── SendTenantManualWhatsAppUseCase ──────────────────────────────────────────

describe('SendTenantManualWhatsAppUseCase — owner not found', () => {
  it('throws BadRequestException when owner is null', async () => {
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers(null) as any,
      makeContacts() as any,
      makeMessaging() as any,
    );
    await expect(uc.execute({ tenantId: TENANT_ID, text: 'hello' }))
      .rejects.toThrow(BadRequestException);
  });

  it('throws with message "Owner user not found for tenant"', async () => {
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers(null) as any,
      makeContacts() as any,
      makeMessaging() as any,
    );
    await expect(uc.execute({ tenantId: TENANT_ID, text: 'hello' }))
      .rejects.toThrow('Owner user not found for tenant');
  });

  it('does not call ensureContact when owner is null', async () => {
    const contacts = makeContacts();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers(null) as any,
      contacts as any,
      makeMessaging() as any,
    );
    await expect(uc.execute({ tenantId: TENANT_ID, text: 'hello' })).rejects.toThrow(BadRequestException);
    expect(contacts.ensureContact).not.toHaveBeenCalled();
  });
});

describe('SendTenantManualWhatsAppUseCase — happy paths', () => {
  it('calls ensureContact with owner name and phone', async () => {
    const contacts = makeContacts();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers({ name: 'Maria', phone: '+5511900000001' }) as any,
      contacts as any,
      makeMessaging() as any,
    );
    await uc.execute({ tenantId: TENANT_ID, text: 'hello' });
    expect(contacts.ensureContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', phone: '+5511900000001', stage: 'CUSTOMER' }),
    );
  });

  it('calls queueSystemMessage with WHATSAPP channel', async () => {
    const messaging = makeMessaging();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers() as any,
      makeContacts('c-99') as any,
      messaging as any,
    );
    await uc.execute({ tenantId: TENANT_ID, text: 'test' });
    expect(messaging.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'WHATSAPP', text: 'test' }),
    );
  });

  it('passes contactId from ensureContact to queueSystemMessage', async () => {
    const messaging = makeMessaging();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers() as any,
      makeContacts('contact-xyz') as any,
      messaging as any,
    );
    await uc.execute({ tenantId: TENANT_ID, text: 'msg' });
    expect(messaging.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'contact-xyz' }),
    );
  });

  it('returns result of queueSystemMessage', async () => {
    const messaging = makeMessaging({ queued: true, msgId: 'm1' });
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers() as any,
      makeContacts() as any,
      messaging as any,
    );
    const r = await uc.execute({ tenantId: TENANT_ID, text: 'hello' });
    expect(r).toEqual({ queued: true, msgId: 'm1' });
  });
});

describe('SendTenantManualWhatsAppUseCase — downstream errors', () => {
  it('propagates error from ensureContact', async () => {
    const contacts = { ensureContact: jest.fn().mockRejectedValue(new Error('contact error')) };
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers() as any,
      contacts as any,
      makeMessaging() as any,
    );
    await expect(uc.execute({ tenantId: TENANT_ID, text: 'hi' })).rejects.toThrow('contact error');
  });

  it('propagates error from queueSystemMessage', async () => {
    const messaging = { queueSystemMessage: jest.fn().mockRejectedValue(new Error('queue error')) };
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers() as any,
      makeContacts() as any,
      messaging as any,
    );
    await expect(uc.execute({ tenantId: TENANT_ID, text: 'hi' })).rejects.toThrow('queue error');
  });
});

// ─── ListPlatformTenantsOverviewUseCase ───────────────────────────────────────

describe('ListPlatformTenantsOverviewUseCase — limit/page clamping', () => {
  function makeDao(total = 10) {
    return { listOverview: jest.fn().mockResolvedValue({ items: [], total }) };
  }

  it('clamps limit=0 to 1', async () => {
    const dao = makeDao();
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: 0 });
    expect(r.limit).toBe(1);
    expect(dao.listOverview).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('clamps limit=-5 to 1', async () => {
    const dao = makeDao();
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: -5 });
    expect(r.limit).toBe(1);
  });

  it('clamps limit=200 to 100', async () => {
    const dao = makeDao();
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: 200 });
    expect(r.limit).toBe(100);
  });

  it('clamps page=0 to 1', async () => {
    const dao = makeDao();
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 0, limit: 10 });
    expect(r.page).toBe(1);
  });

  it('clamps page=-1 to 1', async () => {
    const dao = makeDao();
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: -1, limit: 10 });
    expect(r.page).toBe(1);
  });

  it('totalPages is 1 when total=0 (avoids ceil(0/n)=0)', async () => {
    const dao = makeDao(0);
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: 10 });
    expect(r.totalPages).toBe(1);
  });

  it('totalPages is 1 when total equals limit exactly', async () => {
    const dao = makeDao(10);
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: 10 });
    expect(r.totalPages).toBe(1);
  });

  it('totalPages rounds up correctly', async () => {
    const dao = makeDao(11);
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    const r = await uc.execute({ page: 1, limit: 10 });
    expect(r.totalPages).toBe(2);
  });

  it('passes clamped values to dao', async () => {
    const dao = makeDao(50);
    const uc = new ListPlatformTenantsOverviewUseCase(dao as any);
    await uc.execute({ page: 3, limit: 25 });
    expect(dao.listOverview).toHaveBeenCalledWith({ page: 3, limit: 25 });
  });
});

// ─── GetPlatformTenantDetailUseCase ──────────────────────────────────────────

describe('GetPlatformTenantDetailUseCase', () => {
  it('throws NotFoundException when dao returns null', async () => {
    const dao = { getTenantDetail: jest.fn().mockResolvedValue(null) };
    const uc = new GetPlatformTenantDetailUseCase(dao as any);
    await expect(uc.execute({ tenantId: TENANT_ID })).rejects.toThrow(NotFoundException);
  });

  it('throws with message "Tenant not found"', async () => {
    const dao = { getTenantDetail: jest.fn().mockResolvedValue(null) };
    const uc = new GetPlatformTenantDetailUseCase(dao as any);
    await expect(uc.execute({ tenantId: 'missing' })).rejects.toThrow('Tenant not found');
  });

  it('returns tenant detail when dao returns data', async () => {
    const detail = { tenantId: TENANT_ID, companyName: 'Acme' };
    const dao = { getTenantDetail: jest.fn().mockResolvedValue(detail) };
    const uc = new GetPlatformTenantDetailUseCase(dao as any);
    const r = await uc.execute({ tenantId: TENANT_ID });
    expect(r).toEqual(detail);
  });

  it('passes tenantId to dao', async () => {
    const dao = { getTenantDetail: jest.fn().mockResolvedValue({ tenantId: 't-1' }) };
    const uc = new GetPlatformTenantDetailUseCase(dao as any);
    await uc.execute({ tenantId: 't-1' });
    expect(dao.getTenantDetail).toHaveBeenCalledWith('t-1');
  });
});

// ─── PlatformAdminApiKeyGuard ─────────────────────────────────────────────────

describe('PlatformAdminApiKeyGuard — additional edge cases', () => {
  function makeConfig(key: string | undefined) {
    return { get: jest.fn().mockReturnValue(key) } as unknown as ConfigService;
  }

  it('throws UnauthorizedException for different-length key (timing-safe length check)', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig('secret'));
    await expect(guard.canActivate(mockGuardCtx({ 'x-platform-admin-key': 'short' })))
      .rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for same-length wrong key', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig('abcdef'));
    await expect(guard.canActivate(mockGuardCtx({ 'x-platform-admin-key': 'xxxxxx' })))
      .rejects.toThrow(UnauthorizedException);
  });

  it('accepts key from uppercase header X-PLATFORM-ADMIN-KEY', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig('my-secret'));
    const result = await guard.canActivate(mockGuardCtx({ 'X-PLATFORM-ADMIN-KEY': 'my-secret' }));
    expect(result).toBe(true);
  });

  it('throws when header is absent entirely', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig('secret'));
    await expect(guard.canActivate(mockGuardCtx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws when PLATFORM_ADMIN_API_KEY is not configured (undefined)', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig(undefined));
    await expect(guard.canActivate(mockGuardCtx({ 'x-platform-admin-key': 'anything' })))
      .rejects.toThrow(/not configured/);
  });

  it('accepts exact matching key from lowercase header', async () => {
    const guard = new PlatformAdminApiKeyGuard(makeConfig('correct-key'));
    const result = await guard.canActivate(mockGuardCtx({ 'x-platform-admin-key': 'correct-key' }));
    expect(result).toBe(true);
  });
});

// ─── resolveDateRange utility ─────────────────────────────────────────────────

describe('resolveDateRange', () => {
  it('defaults to 30 days when period is undefined', () => {
    const { start, end } = resolveDateRange({});
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('uses 1 day for period=1d', () => {
    const { start, end } = resolveDateRange({ period: '1d' });
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBeCloseTo(1 * 24 * 60 * 60 * 1000, -3);
  });

  it('uses 7 days for period=7d', () => {
    const { start, end } = resolveDateRange({ period: '7d' });
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3);
  });

  it('uses 30 days for period=30d', () => {
    const { start, end } = resolveDateRange({ period: '30d' });
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3);
  });

  it('uses 90 days for period=90d', () => {
    const { start, end } = resolveDateRange({ period: '90d' });
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBeCloseTo(90 * 24 * 60 * 60 * 1000, -3);
  });

  it('uses custom startDate and endDate for period=custom', () => {
    const r = resolveDateRange({ period: 'custom', startDate: '2024-01-01', endDate: '2024-03-01' });
    expect(r.start.toISOString().startsWith('2024-01-01')).toBe(true);
    expect(r.end.toISOString().startsWith('2024-03-01')).toBe(true);
  });

  it('falls back to 30d when period=custom but startDate is missing', () => {
    const { start, end } = resolveDateRange({ period: 'custom' });
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('uses provided endDate as end boundary', () => {
    const r = resolveDateRange({ period: '7d', endDate: '2024-06-01' });
    expect(r.end.toISOString().startsWith('2024-06-01')).toBe(true);
  });

  it('uses now as end when endDate is not provided', () => {
    const before = Date.now();
    const { end } = resolveDateRange({ period: '7d' });
    const after = Date.now();
    expect(end.getTime()).toBeGreaterThanOrEqual(before);
    expect(end.getTime()).toBeLessThanOrEqual(after + 10);
  });

  it('produces NaN date for invalid date string (no validation)', () => {
    const r = resolveDateRange({ period: 'custom', startDate: 'invalid-date', endDate: '2024-01-01' });
    expect(isNaN(r.start.getTime())).toBe(true);
  });
});
