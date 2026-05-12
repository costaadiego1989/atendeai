import { ForbiddenException } from '@shared/domain/exceptions/DomainExceptions';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { GetTenantAgentRuleService } from '../application/services/GetTenantAgentRuleService';
import { ITenantAgentRuleRepository } from '../domain/repositories/ITenantAgentRuleRepository';
import { AgentModule } from '../domain/enums/AgentModule';

describe('GetTenantAgentRuleService', () => {
  let service: GetTenantAgentRuleService;
  let repository: jest.Mocked<ITenantAgentRuleRepository>;

  beforeEach(() => {
    repository = {
      findByModule: jest.fn(),
      findExactByScope: jest.fn(),
      save: jest.fn(),
      saveHistory: jest.fn(),
      listRecentHistory: jest.fn(),
    };
    service = new GetTenantAgentRuleService(repository);
  });

  it('AGENT-U-020: retorna regra quando repositório encontra por módulo', async () => {
    const rule = {
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      customPrompt: 'prompt',
      isActive: true,
      fallbackToGlobal: true,
      revision: 1,
    };
    repository.findByModule.mockResolvedValue(rule);

    const result = await service.get({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      requestingUserId: 'user-1',
      requestingUserTenantId: 'tenant-1',
    });

    expect(result).toEqual(rule);
    expect(repository.findByModule).toHaveBeenCalledWith(
      'tenant-1',
      AgentModule.MESSAGING,
      undefined,
    );
  });

  it('AGENT-U-021: retorna null quando repositório não encontra', async () => {
    repository.findByModule.mockResolvedValue(null);

    const result = await service.get({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      requestingUserId: 'user-1',
      requestingUserTenantId: 'tenant-1',
    });

    expect(result).toBeNull();
  });

  it('AGENT-U-022: lança ForbiddenException quando tenantId != requestingUserTenantId', async () => {
    await expect(
      service.get({
        tenantId: 'tenant-1',
        moduleId: AgentModule.MESSAGING,
        requestingUserId: 'user-1',
        requestingUserTenantId: 'tenant-2',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.findByModule).not.toHaveBeenCalled();
  });

  it('AGENT-U-023: chama parseAgentModule e rejeita módulo inválido', async () => {
    await expect(
      service.get({
        tenantId: 'tenant-1',
        moduleId: 'INVALID_MODULE',
        requestingUserId: 'user-1',
        requestingUserTenantId: 'tenant-1',
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
