// agent-rules unit tests — new coverage
import { ForbiddenException } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { AgentModule } from '../domain/enums/AgentModule';
import {
  normalizeAgentPrompt,
  parseAgentModule,
  MAX_AGENT_RULE_PROMPT_LENGTH,
} from '../application/support/agentRuleDraft';
import { ensureAgentRuleTenantAccess } from '../application/support/agentRuleTenantAccess';
import { UpsertTenantAgentRuleService } from '../application/services/UpsertTenantAgentRuleService';
import { GetTenantAgentRuleService } from '../application/services/GetTenantAgentRuleService';
import { TenantAgentRuleService } from '../application/services/TenantAgentRuleService';
import { GetTenantAgentRuleUseCase } from '../application/use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from '../application/use-cases/UpsertTenantAgentRuleUseCase';
import { PreviewTenantAgentRuleUseCase } from '../application/use-cases/PreviewTenantAgentRuleUseCase';
import { ListTenantAgentRuleHistoryUseCase } from '../application/use-cases/ListTenantAgentRuleHistoryUseCase';
import { ITenantAgentRuleRepository } from '../domain/repositories/ITenantAgentRuleRepository';

jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn((_name, _attrs, fn) => fn()),
}));

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

const BASE_RULE = {
  tenantId: 'tenant-1',
  moduleId: AgentModule.MESSAGING,
  customPrompt: 'valid prompt here',
  isActive: true,
  fallbackToGlobal: true,
  revision: 1,
};

// ===========================================================================
// Section 1: normalizeAgentPrompt
// ===========================================================================
describe('normalizeAgentPrompt', () => {
  it('NEW-U-001: trims leading and trailing whitespace', () => {
    expect(normalizeAgentPrompt('  hello  ')).toBe('hello');
  });

  it('NEW-U-002: accepts prompt at exactly MAX_AGENT_RULE_PROMPT_LENGTH characters', () => {
    const exact = 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH);
    expect(() => normalizeAgentPrompt(exact)).not.toThrow();
    expect(normalizeAgentPrompt(exact)).toBe(exact);
  });

  it('NEW-U-003: throws ValidationErrorException when prompt exceeds MAX by 1', () => {
    const over = 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1);
    expect(() => normalizeAgentPrompt(over)).toThrow(ValidationErrorException);
  });

  it('NEW-U-004: throws when prompt is much longer than MAX', () => {
    const wayOver = 'x'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 500);
    expect(() => normalizeAgentPrompt(wayOver)).toThrow(ValidationErrorException);
  });

  it('NEW-U-005: accepts empty string (no minimum enforced at this layer)', () => {
    expect(() => normalizeAgentPrompt('')).not.toThrow();
    expect(normalizeAgentPrompt('')).toBe('');
  });

  it('NEW-U-006: whitespace-only string trims to empty, does not throw', () => {
    expect(() => normalizeAgentPrompt('     ')).not.toThrow();
    expect(normalizeAgentPrompt('     ')).toBe('');
  });

  it('NEW-U-007: prompt long only due to whitespace passes after trim', () => {
    const padded = ' '.repeat(100) + 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH) + ' '.repeat(100);
    expect(() => normalizeAgentPrompt(padded)).not.toThrow();
  });

  it('NEW-U-008: MAX_AGENT_RULE_PROMPT_LENGTH is 1500', () => {
    expect(MAX_AGENT_RULE_PROMPT_LENGTH).toBe(1500);
  });
});

// ===========================================================================
// Section 2: parseAgentModule
// ===========================================================================
describe('parseAgentModule', () => {
  it('NEW-U-010: accepts all valid AgentModule enum values', () => {
    for (const value of Object.values(AgentModule)) {
      expect(() => parseAgentModule(value)).not.toThrow();
      expect(parseAgentModule(value)).toBe(value);
    }
  });

  it('NEW-U-011: throws ValidationErrorException for unknown string', () => {
    expect(() => parseAgentModule('UNKNOWN')).toThrow(ValidationErrorException);
  });

  it('NEW-U-012: throws for empty string', () => {
    expect(() => parseAgentModule('')).toThrow(ValidationErrorException);
  });

  it('NEW-U-013: throws for uppercase variant of valid value', () => {
    expect(() => parseAgentModule('MESSAGING')).toThrow(ValidationErrorException);
  });

  it('NEW-U-014: throws for partial match like messag', () => {
    expect(() => parseAgentModule('messag')).toThrow(ValidationErrorException);
  });

  it('NEW-U-015: throws for null cast as string', () => {
    expect(() => parseAgentModule('null')).toThrow(ValidationErrorException);
  });

  it('NEW-U-016: accepts widget which is a valid enum value', () => {
    expect(parseAgentModule('widget')).toBe(AgentModule.WIDGET);
  });
});

// ===========================================================================
// Section 3: ensureAgentRuleTenantAccess extended
// ===========================================================================
describe('ensureAgentRuleTenantAccess (extended)', () => {
  it('NEW-U-020: does not throw when both IDs are identical UUIDs', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(() => ensureAgentRuleTenantAccess(id, id)).not.toThrow();
  });

  it('NEW-U-021: throws ForbiddenException when IDs differ by one character', () => {
    expect(() =>
      ensureAgentRuleTenantAccess('tenant-abc1', 'tenant-abc2'),
    ).toThrow(ForbiddenException);
  });

  it('NEW-U-022: does NOT throw when both are empty strings (equality holds)', () => {
    expect(() => ensureAgentRuleTenantAccess('', '')).not.toThrow();
  });

  it('NEW-U-023: throws when requestingUserTenantId is empty but tenantId is not', () => {
    expect(() => ensureAgentRuleTenantAccess('tenant-1', '')).toThrow(ForbiddenException);
  });

  it('NEW-U-024: throws when tenantId is empty but requestingUserTenantId is not', () => {
    expect(() => ensureAgentRuleTenantAccess('', 'tenant-1')).toThrow(ForbiddenException);
  });

  it('NEW-U-025: throws for same-looking but differently-cased IDs', () => {
    expect(() =>
      ensureAgentRuleTenantAccess('Tenant-1', 'tenant-1'),
    ).toThrow(ForbiddenException);
  });
});

// ===========================================================================
// Section 4: UpsertTenantAgentRuleService new coverage
// ===========================================================================
describe('UpsertTenantAgentRuleService (new coverage)', () => {
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

  it('NEW-U-030: calls saveWithHistory not save+saveHistory separately', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    expect(repo.saveWithHistory).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.saveHistory).not.toHaveBeenCalled();
  });

  it('NEW-U-031: saveWithHistory receives rule and history as two arguments', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [ruleArg, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.tenantId).toBe('tenant-1');
    expect(historyArg.tenantId).toBe('tenant-1');
    expect(historyArg.revision).toBe(ruleArg.revision);
  });

  it('NEW-U-032: history entry createdAt is a Date instance', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [, historyArg] = repo.saveWithHistory.mock.calls[0];
    expect(historyArg.createdAt).toBeInstanceOf(Date);
  });

  it('NEW-U-033: sets branchId to null when not provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert(baseInput);
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.branchId).toBeNull();
  });

  it('NEW-U-034: passes branchId through when provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({ ...baseInput, branchId: 'branch-abc' });
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.branchId).toBe('branch-abc');
  });

  it('NEW-U-035: isActive defaults to true when undefined', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({ ...baseInput, isActive: undefined });
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.isActive).toBe(true);
  });

  it('NEW-U-036: isActive false is preserved', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({ ...baseInput, isActive: false });
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.isActive).toBe(false);
  });

  it('NEW-U-037: fallbackToGlobal defaults to true when undefined', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await service.upsert({ ...baseInput, fallbackToGlobal: undefined });
    const [ruleArg] = repo.saveWithHistory.mock.calls[0];
    expect(ruleArg.fallbackToGlobal).toBe(true);
  });

  it('NEW-U-038: throws ValidationErrorException for invalid moduleId', async () => {
    await expect(
      service.upsert({ ...baseInput, moduleId: 'bad-module' }),
    ).rejects.toThrow(ValidationErrorException);
    expect(repo.saveWithHistory).not.toHaveBeenCalled();
  });

  it('NEW-U-039: throws ValidationErrorException when prompt is 1 char over MAX', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await expect(
      service.upsert({ ...baseInput, customPrompt: 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1) }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('NEW-U-040: updatedByUserName is Unknown when requestingUserName is empty string', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await service.upsert({ ...baseInput, requestingUserName: '' });
    expect(result.updatedByUserName).toBe('Unknown');
  });

  it('NEW-U-041: notes trimmed to null when whitespace-only', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await service.upsert({ ...baseInput, notes: '   ' });
    expect(result.notes).toBeNull();
  });

  it('NEW-U-042: notes are trimmed when provided with spaces', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await service.upsert({ ...baseInput, notes: '  my note  ' });
    expect(result.notes).toBe('my note');
  });

  it('NEW-U-043: revision starts at 1 when no existing rule', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    const result = await service.upsert(baseInput);
    expect(result.revision).toBe(1);
  });

  it('NEW-U-044: revision increments from existing rule revision', async () => {
    repo.findExactByScope.mockResolvedValue({ ...BASE_RULE, revision: 7 });
    const result = await service.upsert(baseInput);
    expect(result.revision).toBe(8);
  });
});

// ===========================================================================
// Section 5: GetTenantAgentRuleService new coverage
// ===========================================================================
describe('GetTenantAgentRuleService (new coverage)', () => {
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

  it('NEW-U-050: passes branchId to repository when provided', async () => {
    repo.findByModule.mockResolvedValue(null);
    await service.get({ ...baseInput, branchId: 'branch-xyz' });
    expect(repo.findByModule).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, 'branch-xyz');
  });

  it('NEW-U-051: passes undefined branchId when not provided', async () => {
    repo.findByModule.mockResolvedValue(null);
    await service.get(baseInput);
    expect(repo.findByModule).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, undefined);
  });

  it('NEW-U-052: returns the rule as-is from repository', async () => {
    const rule = { ...BASE_RULE, inheritedFromTenant: true };
    repo.findByModule.mockResolvedValue(rule);
    const result = await service.get(baseInput);
    expect(result).toEqual(rule);
  });

  it('NEW-U-053: returns null when repository returns null', async () => {
    repo.findByModule.mockResolvedValue(null);
    const result = await service.get(baseInput);
    expect(result).toBeNull();
  });

  it('NEW-U-054: rejects with ForbiddenException before calling repository for cross-tenant', async () => {
    await expect(
      service.get({ ...baseInput, requestingUserTenantId: 'other-tenant' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.findByModule).not.toHaveBeenCalled();
  });

  it('NEW-U-055: rejects with ValidationErrorException for invalid moduleId before repo call', async () => {
    await expect(
      service.get({ ...baseInput, moduleId: 'not-a-module' }),
    ).rejects.toThrow(ValidationErrorException);
    expect(repo.findByModule).not.toHaveBeenCalled();
  });

  it('NEW-U-056: works for every valid AgentModule value', async () => {
    repo.findByModule.mockResolvedValue(null);
    for (const mod of Object.values(AgentModule)) {
      await expect(service.get({ ...baseInput, moduleId: mod })).resolves.toBeNull();
    }
    expect(repo.findByModule).toHaveBeenCalledTimes(Object.values(AgentModule).length);
  });
});

// ===========================================================================
// Section 6: TenantAgentRuleService facade error propagation
// ===========================================================================
describe('TenantAgentRuleService error propagation', () => {
  let service: TenantAgentRuleService;
  let getRuleUseCase: jest.Mocked<GetTenantAgentRuleUseCase>;
  let upsertRuleUseCase: jest.Mocked<UpsertTenantAgentRuleUseCase>;

  beforeEach(() => {
    getRuleUseCase = { execute: jest.fn() } as any;
    upsertRuleUseCase = { execute: jest.fn() } as any;
    service = new TenantAgentRuleService(getRuleUseCase, upsertRuleUseCase);
  });

  it('NEW-U-060: getRule propagates ForbiddenException through traceAsync', async () => {
    getRuleUseCase.execute.mockRejectedValue(new ForbiddenException('no access'));
    await expect(
      service.getRule('tenant-1', AgentModule.MESSAGING, 'user-1', 'tenant-other'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('NEW-U-061: getRule propagates ValidationErrorException', async () => {
    getRuleUseCase.execute.mockRejectedValue(new ValidationErrorException('bad module'));
    await expect(service.getRule('tenant-1', 'bad-module')).rejects.toThrow(ValidationErrorException);
  });

  it('NEW-U-062: setRule propagates ForbiddenException from upsert', async () => {
    upsertRuleUseCase.execute.mockRejectedValue(new ForbiddenException('denied'));
    await expect(
      service.setRule('tenant-1', AgentModule.MESSAGING, 'prompt', true, 'user-1', 'tenant-other'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('NEW-U-063: setRule propagates ValidationErrorException from upsert', async () => {
    upsertRuleUseCase.execute.mockRejectedValue(new ValidationErrorException('too long'));
    await expect(
      service.setRule('tenant-1', AgentModule.MESSAGING, 'x'.repeat(2000)),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('NEW-U-064: getRule defaults requestingUserId to SYSTEM when not provided', async () => {
    getRuleUseCase.execute.mockResolvedValue(null);
    await service.getRule('tenant-1', AgentModule.MESSAGING);
    expect(getRuleUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ requestingUserId: 'SYSTEM' }),
    );
  });

  it('NEW-U-065: getRule defaults requestingUserTenantId to tenantId when not provided', async () => {
    getRuleUseCase.execute.mockResolvedValue(null);
    await service.getRule('tenant-abc', AgentModule.MESSAGING);
    expect(getRuleUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ requestingUserTenantId: 'tenant-abc' }),
    );
  });

  it('NEW-U-066: setRule passes all arguments to use case correctly', async () => {
    upsertRuleUseCase.execute.mockResolvedValue({ ...BASE_RULE });
    await service.setRule('tenant-1', AgentModule.SALES, 'my prompt', false, 'user-2', 'tenant-1', 'branch-1');
    expect(upsertRuleUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      moduleId: AgentModule.SALES,
      customPrompt: 'my prompt',
      isActive: false,
      requestingUserId: 'user-2',
      requestingUserTenantId: 'tenant-1',
      branchId: 'branch-1',
    });
  });
});

// ===========================================================================
// Section 7: PreviewTenantAgentRuleUseCase new coverage
// ===========================================================================
describe('PreviewTenantAgentRuleUseCase (new coverage)', () => {
  let useCase: PreviewTenantAgentRuleUseCase;
  let repo: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'valid prompt text',
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repo = makeRepo();
    useCase = new PreviewTenantAgentRuleUseCase(repo);
  });

  it('NEW-U-070: throws ValidationErrorException for invalid moduleId', async () => {
    await expect(useCase.execute({ ...baseInput, moduleId: 'invalid-mod' })).rejects.toThrow(ValidationErrorException);
    expect(repo.findExactByScope).not.toHaveBeenCalled();
  });

  it('NEW-U-071: throws ValidationErrorException when prompt exceeds MAX', async () => {
    await expect(
      useCase.execute({ ...baseInput, customPrompt: 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1) }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('NEW-U-072: accepts prompt at exactly MAX_AGENT_RULE_PROMPT_LENGTH chars', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await expect(
      useCase.execute({ ...baseInput, customPrompt: 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH) }),
    ).resolves.toBeDefined();
  });

  it('NEW-U-073: passes branchId to findExactByScope when provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await useCase.execute({ ...baseInput, branchId: 'branch-99' });
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, 'branch-99');
  });

  it('NEW-U-074: passes undefined branchId to findExactByScope when not provided', async () => {
    repo.findExactByScope.mockResolvedValue(null);
    await useCase.execute(baseInput);
    expect(repo.findExactByScope).toHaveBeenCalledWith('tenant-1', AgentModule.MESSAGING, undefined);
  });

  it('NEW-U-075: wouldBeRevision is 1 when existing revision is 0', async () => {
    repo.findExactByScope.mockResolvedValue({ ...BASE_RULE, revision: 0 });
    const result = await useCase.execute(baseInput);
    expect(result.wouldBeRevision).toBe(1);
  });

  it('NEW-U-076: tenant mismatch throws ForbiddenException before any repo call', async () => {
    await expect(
      useCase.execute({ ...baseInput, requestingUserTenantId: 'other' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.findExactByScope).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Section 8: ListTenantAgentRuleHistoryUseCase new coverage
// ===========================================================================
describe('ListTenantAgentRuleHistoryUseCase (new coverage)', () => {
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

  it('NEW-U-080: limit 0 is clamped to 1', async () => {
    await useCase.execute({ ...baseInput, limit: 0 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('NEW-U-081: limit 101 is clamped to 100', async () => {
    await useCase.execute({ ...baseInput, limit: 101 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('NEW-U-082: limit undefined uses default 25', async () => {
    await useCase.execute({ ...baseInput, limit: undefined });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
  });

  it('NEW-U-083: limit exactly 100 is not clamped', async () => {
    await useCase.execute({ ...baseInput, limit: 100 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('NEW-U-084: limit exactly 1 is not clamped', async () => {
    await useCase.execute({ ...baseInput, limit: 1 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('NEW-U-085: passes branchId when provided', async () => {
    await useCase.execute({ ...baseInput, branchId: 'b-123' });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b-123' }));
  });

  it('NEW-U-086: passes null branchId when not provided', async () => {
    await useCase.execute(baseInput);
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
  });

  it('NEW-U-087: throws ForbiddenException for cross-tenant access', async () => {
    await expect(
      useCase.execute({ ...baseInput, requestingUserTenantId: 'tenant-X' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.listRecentHistory).not.toHaveBeenCalled();
  });

  it('NEW-U-088: throws ValidationErrorException for invalid moduleId', async () => {
    await expect(
      useCase.execute({ ...baseInput, moduleId: 'garbage' }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('NEW-U-089: returns the array from the repository as-is', async () => {
    const history = [{
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      customPrompt: 'prompt',
      revision: 2,
      createdAt: new Date(),
    }];
    repo.listRecentHistory.mockResolvedValue(history);
    const result = await useCase.execute(baseInput);
    expect(result).toEqual(history);
  });

  it('NEW-U-090: large negative limit is clamped to 1', async () => {
    await useCase.execute({ ...baseInput, limit: -9999 });
    expect(repo.listRecentHistory).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });
});
