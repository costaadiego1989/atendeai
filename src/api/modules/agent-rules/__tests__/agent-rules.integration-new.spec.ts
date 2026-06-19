// agent-rules.integration-new.spec.ts — integration tests with real service classes and mocked repositories
import { ForbiddenException } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { AgentModule } from '../domain/enums/AgentModule';
import {
  MAX_AGENT_RULE_PROMPT_LENGTH,
} from '../application/support/agentRuleDraft';
import { UpsertTenantAgentRuleService } from '../application/services/UpsertTenantAgentRuleService';
import { GetTenantAgentRuleService } from '../application/services/GetTenantAgentRuleService';
import { PreviewTenantAgentRuleUseCase } from '../application/use-cases/PreviewTenantAgentRuleUseCase';
import { ListTenantAgentRuleHistoryUseCase } from '../application/use-cases/ListTenantAgentRuleHistoryUseCase';
import { PrismaTenantAgentRuleRepository } from '../infrastructure/persistence/repositories/PrismaTenantAgentRuleRepository';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
} from '../domain/repositories/ITenantAgentRuleRepository';

jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn((_name, _attrs, fn) => fn()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRepo(): jest.Mocked<ITenantAgentRuleRepository> {
  return {
    findByModule: jest.fn(),
    findExactByScope: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    saveHistory: jest.fn().mockResolvedValue(undefined),
    saveWithHistory: jest.fn().mockResolvedValue(undefined),
    listRecentHistory: jest.fn().mockResolvedValue([]),
  };
}

function makePrisma() {
  const txMock = {
    tenantAgentRule: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'rule-id-1' }),
      update: jest.fn().mockResolvedValue({ id: 'rule-id-1' }),
    },
    tenantAgentRuleHistory: {
      create: jest.fn().mockResolvedValue({ id: 'hist-id-1' }),
    },
  };
  return {
    tenantAgentRule: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    tenantAgentRuleHistory: {
      create: jest.fn().mockResolvedValue({ id: 'hist-id-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
    _txMock: txMock,
  };
}

const BASE_RULE: TenantAgentRule = {
  tenantId: 'tenant-1',
  moduleId: AgentModule.MESSAGING,
  customPrompt: 'my valid prompt text',
  isActive: true,
  fallbackToGlobal: true,
  revision: 1,
  branchId: null,
};

// ===========================================================================
// PrismaTenantAgentRuleRepository — findByModule scope logic
// ===========================================================================
describe('PrismaTenantAgentRuleRepository.findByModule scope logic', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaTenantAgentRuleRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaTenantAgentRuleRepository(prisma as any);
  });

  it('NEW-I-001: no branchId — queries only tenant scope (findExactByScope with null branchId)', async () => {
    const spy = jest.spyOn(repo, 'findExactByScope').mockResolvedValue(null);
    await repo.findByModule('tenant-1', AgentModule.MESSAGING, null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, null);
  });

  it('NEW-I-002: with branchId — queries branch first then falls back to tenant', async () => {
    const spy = jest.spyOn(repo, 'findExactByScope').mockResolvedValue(null);
    await repo.findByModule('tenant-1', AgentModule.MESSAGING, 'branch-1');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'tenant-1', AgentModule.MESSAGING, 'branch-1');
    expect(spy).toHaveBeenNthCalledWith(2, 'tenant-1', AgentModule.MESSAGING, null);
  });

  it('NEW-I-003: branch rule found — returns with inheritedFromTenant false', async () => {
    const branchRule = { ...BASE_RULE, branchId: 'branch-1' };
    jest.spyOn(repo, 'findExactByScope').mockResolvedValueOnce(branchRule);
    const result = await repo.findByModule('tenant-1', AgentModule.MESSAGING, 'branch-1');
    expect(result).not.toBeNull();
    expect(result!.inheritedFromTenant).toBe(false);
  });

  it('NEW-I-004: branch rule NOT found but tenant rule exists — inheritedFromTenant is true', async () => {
    const spy = jest.spyOn(repo, 'findExactByScope')
      .mockResolvedValueOnce(null)     // branch: not found
      .mockResolvedValueOnce(BASE_RULE); // tenant: found
    const result = await repo.findByModule('tenant-1', AgentModule.MESSAGING, 'branch-1');
    expect(result).not.toBeNull();
    expect(result!.inheritedFromTenant).toBe(true);
    void spy;
  });

  it('NEW-I-005: no branchId + tenant rule found — inheritedFromTenant is false', async () => {
    jest.spyOn(repo, 'findExactByScope').mockResolvedValueOnce(BASE_RULE);
    const result = await repo.findByModule('tenant-1', AgentModule.MESSAGING, null);
    expect(result).not.toBeNull();
    expect(result!.inheritedFromTenant).toBe(false);
  });

  it('NEW-I-006: both branch and tenant rules missing — returns null', async () => {
    jest.spyOn(repo, 'findExactByScope').mockResolvedValue(null);
    const result = await repo.findByModule('tenant-1', AgentModule.MESSAGING, 'branch-1');
    expect(result).toBeNull();
  });

  it('NEW-I-007: tenant rule only, no branchId — inheritedFromTenant is false (branchId is falsy)', async () => {
    jest.spyOn(repo, 'findExactByScope').mockResolvedValueOnce(BASE_RULE);
    const result = await repo.findByModule('tenant-1', AgentModule.MESSAGING, undefined);
    expect(result!.inheritedFromTenant).toBe(false);
  });
});

// ===========================================================================
// PrismaTenantAgentRuleRepository — saveWithHistory transaction
// ===========================================================================
describe('PrismaTenantAgentRuleRepository.saveWithHistory transaction', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaTenantAgentRuleRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaTenantAgentRuleRepository(prisma as any);
  });

  const rule: TenantAgentRule = {
    tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING,
    customPrompt: 'new prompt', isActive: true, fallbackToGlobal: true,
    revision: 1, branchId: null,
  };
  const history = {
    tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING,
    customPrompt: 'new prompt', revision: 1,
    createdAt: new Date(), branchId: null,
  };

  it('NEW-I-010: calls prisma.$transaction once', async () => {
    await repo.saveWithHistory(rule, history);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('NEW-I-011: creates rule when no existing record', async () => {
    prisma._txMock.tenantAgentRule.findFirst.mockResolvedValue(null);
    await repo.saveWithHistory(rule, history);
    expect(prisma._txMock.tenantAgentRule.create).toHaveBeenCalledTimes(1);
    expect(prisma._txMock.tenantAgentRule.update).not.toHaveBeenCalled();
  });

  it('NEW-I-012: updates rule when existing record found', async () => {
    prisma._txMock.tenantAgentRule.findFirst.mockResolvedValue({ id: 'existing-id' });
    await repo.saveWithHistory(rule, history);
    expect(prisma._txMock.tenantAgentRule.update).toHaveBeenCalledTimes(1);
    expect(prisma._txMock.tenantAgentRule.create).not.toHaveBeenCalled();
  });

  it('NEW-I-013: always creates history entry in same transaction', async () => {
    await repo.saveWithHistory(rule, history);
    expect(prisma._txMock.tenantAgentRuleHistory.create).toHaveBeenCalledTimes(1);
  });

  it('NEW-I-014: transaction rollback — if history create throws, entire tx rolls back', async () => {
    prisma._txMock.tenantAgentRuleHistory.create.mockRejectedValue(new Error('history insert failed'));
    await expect(repo.saveWithHistory(rule, history)).rejects.toThrow('history insert failed');
  });

  it('NEW-I-015: transaction rollback — if rule create throws, history is never inserted', async () => {
    prisma._txMock.tenantAgentRule.findFirst.mockResolvedValue(null);
    prisma._txMock.tenantAgentRule.create.mockRejectedValue(new Error('rule insert failed'));
    await expect(repo.saveWithHistory(rule, history)).rejects.toThrow('rule insert failed');
    expect(prisma._txMock.tenantAgentRuleHistory.create).not.toHaveBeenCalled();
  });

  it('NEW-I-016: history entry branchId is set to null when rule has null branchId', async () => {
    await repo.saveWithHistory(rule, history);
    const histCreate = prisma._txMock.tenantAgentRuleHistory.create.mock.calls[0][0];
    expect(histCreate.data.branchId).toBeNull();
  });

  it('NEW-I-017: history entry branchId propagated from rule branchId', async () => {
    const branchRule = { ...rule, branchId: 'branch-x' };
    const branchHistory = { ...history, branchId: 'branch-x' };
    await repo.saveWithHistory(branchRule, branchHistory);
    const histCreate = prisma._txMock.tenantAgentRuleHistory.create.mock.calls[0][0];
    expect(histCreate.data.branchId).toBe('branch-x');
  });
});

// ===========================================================================
// PrismaTenantAgentRuleRepository — findExactByScope scope differentiation
// ===========================================================================
describe('PrismaTenantAgentRuleRepository.findExactByScope scope', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaTenantAgentRuleRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaTenantAgentRuleRepository(prisma as any);
  });

  it('NEW-I-020: calls findFirst with branchId null when branchId not provided', async () => {
    await repo.findExactByScope('tenant-1', AgentModule.MESSAGING);
    expect(prisma.tenantAgentRule.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', moduleId: 'messaging', branchId: null },
    });
  });

  it('NEW-I-021: calls findFirst with branchId null when passed null explicitly', async () => {
    await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, null);
    expect(prisma.tenantAgentRule.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', moduleId: 'messaging', branchId: null },
    });
  });

  it('NEW-I-022: calls findFirst with actual branchId when provided', async () => {
    await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, 'branch-abc');
    expect(prisma.tenantAgentRule.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', moduleId: 'messaging', branchId: 'branch-abc' },
    });
  });

  it('NEW-I-023: returns null when prisma returns null', async () => {
    prisma.tenantAgentRule.findFirst.mockResolvedValue(null);
    const result = await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, null);
    expect(result).toBeNull();
  });

  it('NEW-I-024: returns domain model when prisma returns a record', async () => {
    const prismaRecord = {
      id: 'rule-id-1',
      tenantId: 'tenant-1',
      branchId: null,
      moduleId: 'messaging',
      customPrompt: 'prompt',
      isActive: true,
      fallbackToGlobal: true,
      revision: 3,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: null,
      updatedByUserName: null,
    };
    prisma.tenantAgentRule.findFirst.mockResolvedValue(prismaRecord);
    const result = await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, null);
    expect(result).not.toBeNull();
    expect(result!.revision).toBe(3);
    expect(result!.moduleId).toBe(AgentModule.MESSAGING);
  });

  it('NEW-I-025: null and undefined branchId are treated identically in WHERE clause', async () => {
    const spy = prisma.tenantAgentRule.findFirst;
    await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, undefined);
    await repo.findExactByScope('tenant-1', AgentModule.MESSAGING, null);
    const call1Where = spy.mock.calls[0][0].where;
    const call2Where = spy.mock.calls[1][0].where;
    expect(call1Where.branchId).toBe(call2Where.branchId);
  });
});

// ===========================================================================
// PrismaTenantAgentRuleRepository — listRecentHistory repository-level clamp
// ===========================================================================
describe('PrismaTenantAgentRuleRepository.listRecentHistory clamp', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaTenantAgentRuleRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaTenantAgentRuleRepository(prisma as any);
  });

  it('NEW-I-030: takes limit of 1 when passed 0', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: null, limit: 0 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it('NEW-I-031: takes limit of 100 when passed 999', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: null, limit: 999 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('NEW-I-032: takes limit of 25 when passed exactly 25', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: null, limit: 25 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it('NEW-I-033: filters by tenantId in WHERE', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-abc', moduleId: AgentModule.MESSAGING, branchId: null, limit: 10 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-abc' }) }),
    );
  });

  it('NEW-I-034: filters by moduleId in WHERE', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.SALES, branchId: null, limit: 10 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ moduleId: 'sales' }) }),
    );
  });

  it('NEW-I-035: filters by branchId null in WHERE', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: null, limit: 10 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: null }) }),
    );
  });

  it('NEW-I-036: filters by actual branchId in WHERE', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: 'branch-1', limit: 10 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 'branch-1' }) }),
    );
  });

  it('NEW-I-037: orders by createdAt desc', async () => {
    await repo.listRecentHistory({ tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING, branchId: null, limit: 10 });
    expect(prisma.tenantAgentRuleHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

// ===========================================================================
// UpsertTenantAgentRuleService + Repository wiring (real service, mocked repo)
// ===========================================================================
describe('UpsertTenantAgentRuleService + mocked repository wiring', () => {
  let service: UpsertTenantAgentRuleService;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'valid prompt content here',
    isActive: true,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
    requestingUserName: 'Alice',
  };

  beforeEach(() => {
    repo = makeRepo();
    service = new UpsertTenantAgentRuleService(repo);
  });

  it('NEW-I-040: saveWithHistory is called with matching tenantId', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.tenantId).toBe('tenant-1');
  });

  it('NEW-I-041: saveWithHistory history has matching moduleId', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(historyArg.moduleId).toBe(AgentModule.MESSAGING);
  });

  it('NEW-I-042: saveWithHistory history.updatedByUserName equals requestingUserName', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(historyArg.updatedByUserName).toBe('Alice');
  });

  it('NEW-I-043: saveWithHistory history.updatedByUserId equals requestingUserId', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(historyArg.updatedByUserId).toBe('user-1');
  });

  it('NEW-I-044: findExactByScope is called with correct args before save', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, undefined);
  });

  it('NEW-I-045: findExactByScope uses branchId when provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({ ...baseInput, branchId: 'b-99' });
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, 'b-99');
  });

  it('NEW-I-046: ForbiddenException prevents saveWithHistory from being called', async () => {
    await expect(
      service.upsert({ ...baseInput, requestingUserTenantId: 'tenant-other' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.saveWithHistory).not.toHaveBeenCalled();
  });

  it('NEW-I-047: ValidationErrorException prevents saveWithHistory for bad module', async () => {
    await expect(
      service.upsert({ ...baseInput, moduleId: 'not-a-module' }),
    ).rejects.toThrow(ValidationErrorException);
    expect(repo.saveWithHistory).not.toHaveBeenCalled();
  });

  it('NEW-I-048: ValidationErrorException prevents saveWithHistory for prompt too long', async () => {
    await expect(
      service.upsert({ ...baseInput, customPrompt: 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1) }),
    ).rejects.toThrow(ValidationErrorException);
    expect(repo.saveWithHistory).not.toHaveBeenCalled();
  });

  it('NEW-I-049: revision in rule and history match', async () => {
    repo.findExactByScope.mockResolvedValue({ ...BASE_RULE, revision: 4 });
    await service.upsert(baseInput);
    const [ruleArg, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.revision).toBe(5);
    expect(historyArg.revision).toBe(5);
  });
});

// ===========================================================================
// GetTenantAgentRuleService + Repository wiring
// ===========================================================================
describe('GetTenantAgentRuleService + mocked repository wiring', () => {
  let service: GetTenantAgentRuleService;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repo = makeRepo();
    service = new GetTenantAgentRuleService(repo);
  });

  it('NEW-I-050: returns rule with inheritedFromTenant true when branch fallback occurs', async () => {
    const inheritedRule = { ...BASE_RULE, inheritedFromTenant: true };
    repo.findByModule.mockResolvedValue(inheritedRule);
    const result = await service.get({ ...baseInput, branchId: 'branch-1' });
    expect(result!.inheritedFromTenant).toBe(true);
  });

  it('NEW-I-051: returns rule with inheritedFromTenant false for direct match', async () => {
    const directRule = { ...BASE_RULE, inheritedFromTenant: false };
    repo.findByModule.mockResolvedValue(directRule);
    const result = await service.get(baseInput);
    expect(result!.inheritedFromTenant).toBe(false);
  });

  it('NEW-I-052: cross-tenant access check fires before findByModule', async () => {
    await expect(
      service.get({ ...baseInput, requestingUserTenantId: 'attacker' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.findByModule).not.toHaveBeenCalled();
  });

  it('NEW-I-053: module validation fires before findByModule', async () => {
    await expect(
      service.get({ ...baseInput, moduleId: 'INVALID' }),
    ).rejects.toThrow(ValidationErrorException);
    expect(repo.findByModule).not.toHaveBeenCalled();
  });

  it('NEW-I-054: null return from repository propagates to caller', async () => {
    repo.findByModule.mockResolvedValue(null);
    const result = await service.get(baseInput);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// PreviewTenantAgentRuleUseCase + Repository wiring
// ===========================================================================
describe('PreviewTenantAgentRuleUseCase + mocked repository wiring', () => {
  let useCase: PreviewTenantAgentRuleUseCase;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'test prompt here',
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repo = makeRepo();
    useCase = new PreviewTenantAgentRuleUseCase(repo);
  });

  it('NEW-I-060: findExactByScope is called with correct tenant and module', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await useCase.execute(baseInput);
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, undefined);
  });

  it('NEW-I-061: output normalizedCustomPrompt is trimmed version of input', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await useCase.execute({ ...baseInput, customPrompt: '  trimmed  ' });
    expect(result.normalizedCustomPrompt).toBe('trimmed');
  });

  it('NEW-I-062: currentStoredRevision is 0 when no existing rule', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await useCase.execute(baseInput);
    expect(result.currentStoredRevision).toBe(0);
  });

  it('NEW-I-063: wouldBeRevision is currentStoredRevision + 1', async () => {
    repo.findExactByScope.mockResolvedValue({ ...BASE_RULE, revision: 9 });
    const result = await useCase.execute(baseInput);
    expect(result.currentStoredRevision).toBe(9);
    expect(result.wouldBeRevision).toBe(10);
  });

  it('NEW-I-064: notesTrimmed is null when notes is empty after trim', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await useCase.execute({ ...baseInput, notes: '   ' });
    expect(result.notesTrimmed).toBeNull();
  });

  it('NEW-I-065: notesTrimmed contains trimmed note text when provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await useCase.execute({ ...baseInput, notes: ' my note ' });
    expect(result.notesTrimmed).toBe('my note');
  });
});

// ===========================================================================
// ListTenantAgentRuleHistoryUseCase + Repository wiring
// ===========================================================================
describe('ListTenantAgentRuleHistoryUseCase + mocked repository wiring', () => {
  let useCase: ListTenantAgentRuleHistoryUseCase;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repo = makeRepo();
    useCase = new ListTenantAgentRuleHistoryUseCase(repo);
  });

  it('NEW-I-070: listRecentHistory called with correct tenantId', async () => {
    await useCase.execute(baseInput);
    expect(repo.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('NEW-I-071: listRecentHistory called with correct moduleId', async () => {
    await useCase.execute({ ...baseInput, moduleId: AgentModule.SALES });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: AgentModule.SALES }),
    );
  });

  it('NEW-I-072: clamping to 25 at use-case level with undefined limit', async () => {
    await useCase.execute(baseInput);
    expect(repo.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it('NEW-I-073: use-case clamps limit to 100 before calling repo', async () => {
    await useCase.execute({ ...baseInput, limit: 500 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('NEW-I-074: use-case clamps limit to 1 for 0', async () => {
    await useCase.execute({ ...baseInput, limit: 0 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 }),
    );
  });

  it('NEW-I-075: result is passed through from repo unmodified', async () => {
    const entries = [{
      tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING,
      customPrompt: 'old', revision: 1, createdAt: new Date(),
    }];
    repo.listRecentHistory.mockResolvedValue(entries);
    const result = await useCase.execute(baseInput);
    expect(result).toEqual(entries);
  });

  it('NEW-I-076: ForbiddenException prevents listRecentHistory call', async () => {
    await expect(
      useCase.execute({ ...baseInput, requestingUserTenantId: 'evil-tenant' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.listRecentHistory).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Concurrent upsert — race conditions
// ===========================================================================
describe('UpsertTenantAgentRuleService concurrent upsert race conditions', () => {
  let service: UpsertTenantAgentRuleService;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'valid prompt content',
    isActive: true,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repo = makeRepo();
    service = new UpsertTenantAgentRuleService(repo);
  });

  it('NEW-I-080: concurrent upserts each call saveWithHistory exactly once', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await Promise.all([
      service.upsert(baseInput),
      service.upsert({ ...baseInput, customPrompt: 'second concurrent prompt' }),
    ]);
    expect(repo.saveWithHistory).toHaveBeenCalledTimes(2);
  });

  it('NEW-I-081: each concurrent call uses its own snapshot of existing rule', async () => {
    repo.findExactByScope
      .mockResolvedValueOnce({ ...BASE_RULE, revision: 3 })
      .mockResolvedValueOnce({ ...BASE_RULE, revision: 3 });
    const [r1, r2] = await Promise.all([
      service.upsert(baseInput),
      service.upsert({ ...baseInput, customPrompt: 'second call prompt content' }),
    ]);
    // Both see revision 3 so both compute 4 — this demonstrates the race condition
    expect(r1.revision).toBe(4);
    expect(r2.revision).toBe(4);
  });

  it('NEW-I-082: saveWithHistory error does not affect subsequent call', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    repo.saveWithHistory
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValue(undefined);
    await expect(service.upsert(baseInput)).rejects.toThrow('DB timeout');
    await expect(service.upsert({ ...baseInput, customPrompt: 'retry prompt content' })).resolves.toBeDefined();
  });
});

// ===========================================================================
// Cross-module scope isolation
// ===========================================================================
describe('Cross-module scope isolation', () => {
  let service: UpsertTenantAgentRuleService;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  beforeEach(() => {
    repo = makeRepo();
    service = new UpsertTenantAgentRuleService(repo);
  });

  it('NEW-I-090: findExactByScope called with messaging module, not sales', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({
      tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING,
      customPrompt: 'messaging prompt', isActive: true,
      requestingUserId: 'u1', requestingUserTenantId: 'tenant-1',
    });
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, undefined);
    expect(repo.findExactByScope).not.toHaveBeenCalledWith('tenant-1', AgentModule.SALES, undefined);
  });

  it('NEW-I-091: upsert for different modules results in different saveWithHistory calls', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({
      tenantId: 'tenant-1', moduleId: AgentModule.MESSAGING,
      customPrompt: 'messaging prompt', isActive: true,
      requestingUserId: 'u1', requestingUserTenantId: 'tenant-1',
    });
    await service.upsert({
      tenantId: 'tenant-1', moduleId: AgentModule.SALES,
      customPrompt: 'sales prompt content', isActive: true,
      requestingUserId: 'u1', requestingUserTenantId: 'tenant-1',
    });
    const firstCall = repo.saveWithHistory.mock.calls[0][0];
    const secondCall = repo.saveWithHistory.mock.calls[1][0];
    expect(firstCall.moduleId).toBe(AgentModule.MESSAGING);
    expect(secondCall.moduleId).toBe(AgentModule.SALES);
  });
});
