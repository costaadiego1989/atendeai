import { ForbiddenException } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { UpsertTenantAgentRuleService } from '../application/services/UpsertTenantAgentRuleService';
import { ITenantAgentRuleRepository } from '../domain/repositories/ITenantAgentRuleRepository';
import { AgentModule } from '../domain/enums/AgentModule';
import { MAX_AGENT_RULE_PROMPT_LENGTH } from '../application/support/agentRuleDraft';

describe('UpsertTenantAgentRuleService', () => {
  let service: UpsertTenantAgentRuleService;
  let repository: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'my prompt',
    isActive: true,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
    requestingUserName: 'John',
  };

  beforeEach(() => {
    repository = {
      findByModule: jest.fn(),
      findExactByScope: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      saveHistory: jest.fn().mockResolvedValue(undefined),
      listRecentHistory: jest.fn(),
    };
    service = new UpsertTenantAgentRuleService(repository);
  });

  it('AGENT-U-030: cria regra nova com revision 1 quando não existe', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await service.upsert(baseInput);

    expect(result.revision).toBe(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('AGENT-U-031: incrementa revision quando regra já existe', async () => {
    repository.findExactByScope.mockResolvedValue({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      customPrompt: 'old prompt',
      isActive: true,
      fallbackToGlobal: true,
      revision: 3,
    });

    const result = await service.upsert(baseInput);

    expect(result.revision).toBe(4);
  });

  it('AGENT-U-032: salva history após save com dados corretos', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await service.upsert(baseInput);

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.saveHistory).toHaveBeenCalledTimes(1);

    const historyArg = repository.saveHistory.mock.calls[0][0];
    expect(historyArg.tenantId).toBe('tenant-1');
    expect(historyArg.moduleId).toBe(AgentModule.MESSAGING);
    expect(historyArg.customPrompt).toBe('my prompt');
    expect(historyArg.revision).toBe(result.revision);
    expect(historyArg.updatedByUserId).toBe('user-1');
    expect(historyArg.updatedByUserName).toBe('John');
    expect(historyArg.createdAt).toBeInstanceOf(Date);
  });

  it('AGENT-U-033: normaliza prompt (trim) antes de salvar', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await service.upsert({
      ...baseInput,
      customPrompt: '  spaced prompt  ',
    });

    expect(result.customPrompt).toBe('spaced prompt');
  });

  it('AGENT-U-034: rejeita prompt acima do limite', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    await expect(
      service.upsert({
        ...baseInput,
        customPrompt: 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationErrorException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('AGENT-U-035: lança ForbiddenException para tenant mismatch', async () => {
    await expect(
      service.upsert({
        ...baseInput,
        requestingUserTenantId: 'tenant-other',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.findExactByScope).not.toHaveBeenCalled();
  });

  it('AGENT-U-036: define updatedByUserName como Unknown quando não fornecido', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await service.upsert({
      ...baseInput,
      requestingUserName: undefined,
    });

    expect(result.updatedByUserName).toBe('Unknown');
  });
});
