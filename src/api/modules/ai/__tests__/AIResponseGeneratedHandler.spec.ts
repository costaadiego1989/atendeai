import { AIResponseGeneratedHandler } from '../application/handlers/AIResponseGeneratedHandler';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { LeadScoringService } from '../domain/services/LeadScoringService';
import { LeadScoredIntegrationEvent } from '../application/integration-events/publishers/AIIntegrationEvents';

describe('AIResponseGeneratedHandler', () => {
  let handler: AIResponseGeneratedHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let leadScoringService: jest.Mocked<LeadScoringService>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    leadScoringService = {
      calculateScore: jest.fn().mockReturnValue(85),
      isHotLead: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<LeadScoringService>;

    handler = new AIResponseGeneratedHandler(eventBus, leadScoringService);
  });

  it('should subscribe to ai.response-generated with a stable consumer name', () => {
    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'ai.response-generated',
      expect.any(Function),
      { consumerName: 'ai-lead-scoring' },
    );
  });

  it('should calculate score and publish ai.lead-scored', async () => {
    let subscribedHandler: ((event: any) => Promise<void>) | undefined;
    eventBus.subscribe.mockImplementation((queue, callback) => {
      if (queue === 'ai.response-generated') {
        subscribedHandler = callback as (event: any) => Promise<void>;
      }
    });

    handler.onModuleInit();

    await subscribedHandler!({
      payload: {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        intent: 'PURCHASE',
        sentiment: 'POSITIVE',
        confidence: 0.95,
      },
    });

    expect(leadScoringService.calculateScore).toHaveBeenCalledWith(
      'PURCHASE',
      'POSITIVE',
      0.95,
    );
    expect(leadScoringService.isHotLead).toHaveBeenCalledWith(85);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      LeadScoredIntegrationEvent,
    );
    expect(eventBus.publish.mock.calls[0][0].payload).toEqual({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      score: 85,
      isHot: true,
      intent: 'PURCHASE',
      sentiment: 'POSITIVE',
    });
  });
});
