import { SalesAnalyticsHandler } from '../application/handlers/SalesAnalyticsHandler';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { TrackSalesMetricUseCase } from '../application/use-cases/TrackSalesMetricUseCase';

describe('SalesAnalyticsHandler', () => {
  let handler: SalesAnalyticsHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let trackSalesMetricUseCase: jest.Mocked<TrackSalesMetricUseCase>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    trackSalesMetricUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<TrackSalesMetricUseCase>;

    handler = new SalesAnalyticsHandler(eventBus, trackSalesMetricUseCase);
  });

  it('should subscribe to messaging and AI analytics events on module init', () => {
    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledTimes(3);
    expect(eventBus.subscribe).toHaveBeenNthCalledWith(
      1,
      'messaging.message-received',
      expect.any(Function),
      { consumerName: 'sales-message-received' },
    );
    expect(eventBus.subscribe).toHaveBeenNthCalledWith(
      2,
      'messaging.message-sent',
      expect.any(Function),
      { consumerName: 'sales-message-sent' },
    );
    expect(eventBus.subscribe).toHaveBeenNthCalledWith(
      3,
      'ai.lead-scored',
      expect.any(Function),
      { consumerName: 'sales-ai-lead-scored' },
    );
  });

  it('should track MESSAGE when messaging.message-received is received', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([eventName]) => eventName === 'messaging.message-received',
    )?.[1] as (event: any) => Promise<void>;

    await callback({
      payload: {
        tenantId: 'tenant-1',
      },
    });

    expect(trackSalesMetricUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      type: 'MESSAGE',
    });
  });

  it('should track MESSAGE when messaging.message-sent is received', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([eventName]) => eventName === 'messaging.message-sent',
    )?.[1] as (event: any) => Promise<void>;

    await callback({
      payload: {
        tenantId: 'tenant-1',
      },
    });

    expect(trackSalesMetricUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      type: 'MESSAGE',
    });
  });

  it('should track INTENT only when the scored lead has PURCHASE intent', async () => {
    handler.onModuleInit();
    const callback = eventBus.subscribe.mock.calls.find(
      ([eventName]) => eventName === 'ai.lead-scored',
    )?.[1] as (event: any) => Promise<void>;

    await callback({
      payload: {
        tenantId: 'tenant-1',
        intent: 'PURCHASE',
      },
    });
    await callback({
      payload: {
        tenantId: 'tenant-1',
        intent: 'SUPPORT',
      },
    });

    expect(trackSalesMetricUseCase.execute).toHaveBeenCalledTimes(1);
    expect(trackSalesMetricUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      type: 'INTENT',
    });
  });
});
