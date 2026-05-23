import { SuggestAgentReplyService } from '../application/services/SuggestAgentReplyService';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';
import { IConversationIntelligenceRepository } from '../domain/repositories/IConversationIntelligenceRepository';
import { IAIEngine } from '../../ai/application/ports/IAIEngine';
import { TenantAgentRuleService } from '../../agent-rules/application/services/TenantAgentRuleService';
import { ICheckQuotaUseCase } from '../../billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { IRecordUsageUseCase } from '../../billing/application/use-cases/interfaces/IRecordUsageUseCase';
import { IContactRepository } from '../../contact/domain/repositories/IContactRepository';

describe('SuggestAgentReplyService', () => {
  let service: SuggestAgentReplyService;
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let intelligenceRepository: jest.Mocked<IConversationIntelligenceRepository>;
  let aiEngine: jest.Mocked<IAIEngine>;
  let tenantAgentRuleService: jest.Mocked<TenantAgentRuleService>;
  let checkQuotaUseCase: jest.Mocked<ICheckQuotaUseCase>;
  let recordUsageUseCase: jest.Mocked<IRecordUsageUseCase>;
  let contactRepository: jest.Mocked<IContactRepository>;

  const tenantId = 'tenant-1';
  const conversationId = 'conversation-1';
  const contactId = 'contact-1';

  beforeEach(() => {
    conversationRepository = {
      findMessagesByConversation: jest.fn().mockResolvedValue({ data: [] }),
      findById: jest.fn(),
      findByTenant: jest.fn(),
      save: jest.fn(),
      findByContactAndTenant: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;

    intelligenceRepository = {
      findByConversationIds: jest.fn().mockResolvedValue({}),
      save: jest.fn(),
    } as unknown as jest.Mocked<IConversationIntelligenceRepository>;

    aiEngine = {
      generateResponse: jest.fn().mockResolvedValue({
        text: 'Resposta IA',
        tokensUsed: 20,
        confidence: 0.9,
        finishReason: 'stop',
      }),
    } as unknown as jest.Mocked<IAIEngine>;

    tenantAgentRuleService = {
      getRule: jest.fn().mockResolvedValue(null),
      setRule: jest.fn(),
    } as unknown as jest.Mocked<TenantAgentRuleService>;

    checkQuotaUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ICheckQuotaUseCase>;

    recordUsageUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IRecordUsageUseCase>;

    contactRepository = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<IContactRepository>;

    service = new SuggestAgentReplyService(
      conversationRepository,
      intelligenceRepository,
      aiEngine,
      tenantAgentRuleService,
      checkQuotaUseCase,
      recordUsageUseCase,
      contactRepository,
    );
  });

  it('should return provisioning message when quota status is NO_SUBSCRIPTION', async () => {
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 0,
      quota: 0,
      status: 'NO_SUBSCRIPTION',
    });

    const result = await service.generateSuggestion(
      tenantId,
      conversationId,
      contactId,
    );

    expect(result.text).toContain('sendo configurada');
    expect(result.text).not.toContain('Limite de uso da IA atingido');
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
  });

  it('should return inactive subscription message when subscription is not active', async () => {
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 0,
      quota: 1000,
      status: 'OVERDUE',
    });

    const result = await service.generateSuggestion(
      tenantId,
      conversationId,
      contactId,
    );

    expect(result.text).toContain('inativa');
    expect(result.text).not.toContain('Limite de uso da IA atingido');
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
  });

  it('should return inactive subscription message when subscription is CANCELED', async () => {
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 0,
      quota: 1000,
      status: 'CANCELED',
    });

    const result = await service.generateSuggestion(
      tenantId,
      conversationId,
      contactId,
    );

    expect(result.text).toContain('inativa');
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
  });

  it('should return quota exceeded message when usage >= quota', async () => {
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 1000,
      quota: 1000,
      status: 'ACTIVE',
    });

    const result = await service.generateSuggestion(
      tenantId,
      conversationId,
      contactId,
    );

    expect(result.text).toContain('Limite de uso da IA atingido');
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
  });

  it('should call AI engine when quota check passes', async () => {
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });

    const result = await service.generateSuggestion(
      tenantId,
      conversationId,
      contactId,
    );

    expect(result.text).toBe('Resposta IA');
    expect(aiEngine.generateResponse).toHaveBeenCalled();
  });

  describe('ADR D2 — branch resolution (regression)', () => {
    beforeEach(() => {
      checkQuotaUseCase.execute.mockResolvedValue({
        canProceed: true,
        used: 10,
        quota: 1000,
        status: 'ACTIVE',
      });
    });

    it('AGENT-U-200: resolves real branchId from contact and never passes contactId as branchId', async () => {
      const realBranchId = 'branch-99';
      contactRepository.findById.mockResolvedValue({
        branchId: realBranchId,
      } as never);

      await service.generateSuggestion(tenantId, conversationId, contactId);

      expect(contactRepository.findById).toHaveBeenCalledWith(
        tenantId,
        contactId,
      );
      expect(tenantAgentRuleService.getRule).toHaveBeenCalledWith(
        tenantId,
        'messaging',
        'SYSTEM',
        tenantId,
        realBranchId,
      );
      const branchArg = tenantAgentRuleService.getRule.mock.calls[0][4];
      expect(branchArg).not.toBe(contactId);
    });

    it('AGENT-U-201: passes null branchId when contact has no branch', async () => {
      contactRepository.findById.mockResolvedValue({
        branchId: null,
      } as never);

      await service.generateSuggestion(tenantId, conversationId, contactId);

      expect(tenantAgentRuleService.getRule).toHaveBeenCalledWith(
        tenantId,
        'messaging',
        'SYSTEM',
        tenantId,
        null,
      );
    });

    it('AGENT-U-202: treats contact lookup failure as non-fatal and passes null branchId', async () => {
      contactRepository.findById.mockRejectedValue(new Error('db down'));

      const result = await service.generateSuggestion(
        tenantId,
        conversationId,
        contactId,
      );

      expect(result.text).toBe('Resposta IA');
      expect(tenantAgentRuleService.getRule).toHaveBeenCalledWith(
        tenantId,
        'messaging',
        'SYSTEM',
        tenantId,
        null,
      );
    });
  });
});
