import { BillingUsageHandlers } from '../application/handlers/BillingUsageHandlers';
import { UsageType } from '../application/use-cases/interfaces/IRecordUsageUseCase';
import { toBillableAiTokens } from '../domain/constants/AiTokenBillingPolicy';

describe('BillingUsageHandlers', () => {
  let handlers: BillingUsageHandlers;
  let eventBus: any;
  let recordUsageUseCase: any;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn(), publish: jest.fn() };
    recordUsageUseCase = { execute: jest.fn() };

    handlers = new BillingUsageHandlers(eventBus, recordUsageUseCase);
    handlers.onModuleInit();
  });

  function getHandler(eventName: string) {
    return eventBus.subscribe.mock.calls.find(
      (call: any[]) => call[0] === eventName,
    )[1];
  }

  describe('messaging.message-sent → records MESSAGE usage', () => {
    it('should call recordUsageUseCase with MESSAGE type', async () => {
      const handler = getHandler('messaging.message-sent');

      await handler({
        payload: {
          tenantId: 'tenant-1',
          conversationId: 'conv-1',
          contactId: 'contact-1',
        },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        type: UsageType.MESSAGE,
      });
    });

    it('should handle multiple messages from same tenant', async () => {
      const handler = getHandler('messaging.message-sent');

      await handler({
        payload: {
          tenantId: 'tenant-1',
          conversationId: 'conv-1',
          contactId: 'c-1',
        },
      });
      await handler({
        payload: {
          tenantId: 'tenant-1',
          conversationId: 'conv-2',
          contactId: 'c-2',
        },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('ai.response-generated → records AI_TOKEN usage with billing policy', () => {
    it('should apply toBillableAiTokens multiplier to tokensUsed', async () => {
      const handler = getHandler('ai.response-generated');

      await handler({
        payload: {
          tenantId: 'tenant-2',
          tokensUsed: 500,
        },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-2',
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(500),
      });
    });

    it('should handle zero tokens gracefully', async () => {
      const handler = getHandler('ai.response-generated');

      await handler({
        payload: {
          tenantId: 'tenant-3',
          tokensUsed: 0,
        },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-3',
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(0),
      });
    });

    it('should correctly bill large token amounts', async () => {
      const handler = getHandler('ai.response-generated');

      await handler({
        payload: {
          tenantId: 'tenant-4',
          tokensUsed: 10000,
        },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-4',
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(10000),
      });
      // Verify the multiplier is applied (3x)
      expect(toBillableAiTokens(10000)).toBe(30000);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from recordUsageUseCase', async () => {
      const handler = getHandler('messaging.message-sent');
      recordUsageUseCase.execute.mockRejectedValue(new Error('DB failure'));

      await expect(
        handler({
          payload: {
            tenantId: 'tenant-5',
            conversationId: 'conv-1',
            contactId: 'c-1',
          },
        }),
      ).rejects.toThrow('DB failure');
    });
  });

  describe('multiple metrics in same cycle', () => {
    it('should record both MESSAGE and AI_TOKEN for same tenant independently', async () => {
      const messageHandler = getHandler('messaging.message-sent');
      const aiHandler = getHandler('ai.response-generated');

      await messageHandler({
        payload: {
          tenantId: 'tenant-6',
          conversationId: 'conv-1',
          contactId: 'c-1',
        },
      });
      await aiHandler({
        payload: { tenantId: 'tenant-6', tokensUsed: 200 },
      });

      expect(recordUsageUseCase.execute).toHaveBeenCalledTimes(2);
      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-6',
        type: UsageType.MESSAGE,
      });
      expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-6',
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(200),
      });
    });
  });
});
