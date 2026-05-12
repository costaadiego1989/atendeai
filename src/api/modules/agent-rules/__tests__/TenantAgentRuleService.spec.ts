import { TenantAgentRuleService } from '../application/services/TenantAgentRuleService';
import { GetTenantAgentRuleUseCase } from '../application/use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from '../application/use-cases/UpsertTenantAgentRuleUseCase';
import { AgentModule } from '../domain/enums/AgentModule';

jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: jest.fn((_name, _attrs, fn) => fn()),
}));

describe('TenantAgentRuleService (facade)', () => {
  let service: TenantAgentRuleService;
  let getRuleUseCase: jest.Mocked<GetTenantAgentRuleUseCase>;
  let upsertRuleUseCase: jest.Mocked<UpsertTenantAgentRuleUseCase>;

  beforeEach(() => {
    getRuleUseCase = {
      execute: jest.fn().mockResolvedValue(null),
    } as any;
    upsertRuleUseCase = {
      execute: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        moduleId: AgentModule.MESSAGING,
        customPrompt: 'prompt',
        isActive: true,
        fallbackToGlobal: true,
        revision: 1,
      }),
    } as any;
    service = new TenantAgentRuleService(getRuleUseCase, upsertRuleUseCase);
  });

  it('AGENT-U-060: getRule delega para GetTenantAgentRuleUseCase com params corretos', async () => {
    await service.getRule('tenant-1', AgentModule.MESSAGING, 'user-1', 'tenant-1', 'branch-1');

    expect(getRuleUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      branchId: 'branch-1',
      requestingUserId: 'user-1',
      requestingUserTenantId: 'tenant-1',
    });
  });

  it('AGENT-U-061: setRule delega para UpsertTenantAgentRuleUseCase com params corretos', async () => {
    await service.setRule(
      'tenant-1',
      AgentModule.MESSAGING,
      'my prompt',
      true,
      'user-1',
      'tenant-1',
      'branch-1',
    );

    expect(upsertRuleUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      moduleId: AgentModule.MESSAGING,
      branchId: 'branch-1',
      customPrompt: 'my prompt',
      isActive: true,
      requestingUserId: 'user-1',
      requestingUserTenantId: 'tenant-1',
    });
  });

  it('AGENT-U-062: getRule usa tenantId como requestingUserTenantId por default', async () => {
    await service.getRule('tenant-1', AgentModule.MESSAGING);

    expect(getRuleUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        requestingUserTenantId: 'tenant-1',
        requestingUserId: 'SYSTEM',
      }),
    );
  });
});
