import { ForbiddenException } from '@nestjs/common';
import { PreviewTenantAgentRuleUseCase } from '../application/use-cases/PreviewTenantAgentRuleUseCase';
import { ITenantAgentRuleRepository } from '../domain/repositories/ITenantAgentRuleRepository';
import { AgentModule } from '../domain/enums/AgentModule';

describe('PreviewTenantAgentRuleUseCase', () => {
  let useCase: PreviewTenantAgentRuleUseCase;
  let repository: jest.Mocked<ITenantAgentRuleRepository>;

  const baseInput = {
    tenantId: 'tenant-1',
    moduleId: AgentModule.MESSAGING,
    customPrompt: 'my prompt',
    requestingUserId: 'user-1',
    requestingUserTenantId: 'tenant-1',
  };

  beforeEach(() => {
    repository = {
      findByModule: jest.fn(),
      findExactByScope: jest.fn(),
      save: jest.fn(),
      saveHistory: jest.fn(),
      listRecentHistory: jest.fn(),
    };
    useCase = new PreviewTenantAgentRuleUseCase(repository);
  });

  it('AGENT-U-040: retorna wouldBeRevision = 1 quando não existe regra', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await useCase.execute(baseInput);

    expect(result.wouldBeRevision).toBe(1);
    expect(result.currentStoredRevision).toBe(0);
  });

  it('AGENT-U-041: retorna wouldBeRevision = N+1 quando existe regra com revision N', async () => {
    repository.findExactByScope.mockResolvedValue({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      customPrompt: 'old',
      isActive: true,
      fallbackToGlobal: true,
      revision: 5,
    });

    const result = await useCase.execute(baseInput);

    expect(result.currentStoredRevision).toBe(5);
    expect(result.wouldBeRevision).toBe(6);
  });

  it('AGENT-U-042: normaliza prompt e retorna no output', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await useCase.execute({
      ...baseInput,
      customPrompt: '  spaced  ',
    });

    expect(result.normalizedCustomPrompt).toBe('spaced');
  });

  it('AGENT-U-043: trim de notes e retorna null quando vazio', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const resultEmpty = await useCase.execute({
      ...baseInput,
      notes: '   ',
    });
    expect(resultEmpty.notesTrimmed).toBeNull();

    const resultWithContent = await useCase.execute({
      ...baseInput,
      notes: '  some note  ',
    });
    expect(resultWithContent.notesTrimmed).toBe('some note');
  });

  it('AGENT-U-044: isActive default true quando não informado', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await useCase.execute({
      ...baseInput,
      isActive: undefined,
    });

    expect(result.isActive).toBe(true);
  });

  it('AGENT-U-045: fallbackToGlobal default true quando não informado', async () => {
    repository.findExactByScope.mockResolvedValue(null);

    const result = await useCase.execute({
      ...baseInput,
      fallbackToGlobal: undefined,
    });

    expect(result.fallbackToGlobal).toBe(true);
  });

  it('AGENT-U-046: lança ForbiddenException para tenant mismatch', async () => {
    await expect(
      useCase.execute({
        ...baseInput,
        requestingUserTenantId: 'tenant-other',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.findExactByScope).not.toHaveBeenCalled();
  });
});
