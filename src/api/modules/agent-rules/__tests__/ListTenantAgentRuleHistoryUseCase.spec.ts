import { ForbiddenException } from '@nestjs/common';
import { ListTenantAgentRuleHistoryUseCase } from '../application/use-cases/ListTenantAgentRuleHistoryUseCase';
import { ITenantAgentRuleRepository } from '../domain/repositories/ITenantAgentRuleRepository';
import { AgentModule } from '../domain/enums/AgentModule';

describe('ListTenantAgentRuleHistoryUseCase', () => {
  let useCase: ListTenantAgentRuleHistoryUseCase;
  let repository: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repository = {
      findByModule: jest.fn(),
      findExactByScope: jest.fn(),
      save: jest.fn(),
      saveHistory: jest.fn(),
      listRecentHistory: jest.fn().mockResolvedValue([]),
    };
    useCase = new ListTenantAgentRuleHistoryUseCase(repository);
  });

  it('AGENT-U-050: clamp limit para mínimo 1', async () => {
    await useCase.execute({ ...baseInput, limit: -5 });

    expect(repository.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 }),
    );
  });

  it('AGENT-U-051: clamp limit para máximo 100', async () => {
    await useCase.execute({ ...baseInput, limit: 500 });

    expect(repository.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('AGENT-U-052: default limit 25 quando não informado', async () => {
    await useCase.execute({ ...baseInput });

    expect(repository.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it('AGENT-U-053: lança ForbiddenException para tenant mismatch', async () => {
    await expect(
      useCase.execute({
        ...baseInput,
        requestingUserTenantId: 'tenant-other',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.listRecentHistory).not.toHaveBeenCalled();
  });

  it('AGENT-U-054: passa branchId null quando não informado', async () => {
    await useCase.execute({ ...baseInput });

    expect(repository.listRecentHistory).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null }),
    );
  });
});
