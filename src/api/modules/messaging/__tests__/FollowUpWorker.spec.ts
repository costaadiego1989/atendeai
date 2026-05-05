const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn();
const mockWorkerCtor = jest.fn().mockImplementation(() => ({
  on: mockWorkerOn,
  close: mockWorkerClose,
}));

jest.mock('bullmq', () => ({
  Worker: mockWorkerCtor,
}));

import { ConfigService } from '@nestjs/config';
import { IEventBus } from '@shared/infrastructure/event-bus';
import { FollowUpAuditService } from '@modules/messaging/application/services/FollowUpAuditService';
import { FollowUpWorker } from '@modules/messaging/application/workers/FollowUpWorker';
import { FollowUpTriggeredEvent } from '@modules/messaging/application/events/FollowUpTriggeredEvent';
import { IConversationIntelligenceRepository } from '@modules/messaging/domain/repositories/IConversationIntelligenceRepository';

describe('FollowUpWorker', () => {
  let worker: FollowUpWorker;
  let configService: jest.Mocked<ConfigService>;
  let eventBus: jest.Mocked<IEventBus>;
  let followUpAuditService: jest.Mocked<FollowUpAuditService>;
  let conversationIntelligenceRepository: jest.Mocked<IConversationIntelligenceRepository>;
  let structuredLog: { emit: jest.Mock };

  beforeEach(() => {
    mockWorkerCtor.mockClear();
    mockWorkerOn.mockClear();
    mockWorkerClose.mockClear();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    } as unknown as jest.Mocked<ConfigService>;
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    followUpAuditService = {
      record: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<FollowUpAuditService>;
    conversationIntelligenceRepository = {
      findByConversationIds: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<IConversationIntelligenceRepository>;
    structuredLog = { emit: jest.fn() };

    worker = new FollowUpWorker(
      configService,
      eventBus,
      followUpAuditService,
      conversationIntelligenceRepository,
      structuredLog as any,
    );
  });

  it('should configure bull worker and publish follow-up event when a job is processed', async () => {
    worker.onModuleInit();

    expect(mockWorkerCtor).toHaveBeenCalledWith(
      'follow-up',
      expect.any(Function),
      expect.objectContaining({
        connection: { host: 'localhost', port: 6379 },
        concurrency: 10,
      }),
    );
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));

    const processor = mockWorkerCtor.mock.calls[0][1] as (job: any) => Promise<void>;
    await processor({
      id: 'bull-follow-up-99',
      data: {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        interval: '12h',
      },
    });

    expect(conversationIntelligenceRepository.findByConversationIds).toHaveBeenCalledWith(
      'tenant-1',
      ['conversation-1'],
    );
    expect(followUpAuditService.record).toHaveBeenCalledWith(
      'conversation-1',
      '12h',
      'TRIGGERED',
    );
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(FollowUpTriggeredEvent);
    expect((eventBus.publish.mock.calls[0][0] as FollowUpTriggeredEvent).payload)
      .toEqual({
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        interval: '12h',
      });
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'messaging.follow_up.job_started',
        tenantId: 'tenant-1',
        attributes: expect.objectContaining({
          queue_job_id: 'bull-follow-up-99',
          conversation_id: 'conversation-1',
        }),
      }),
    );
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'messaging.follow_up.job_completed',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('should close the bull worker on module destroy', async () => {
    worker.onModuleInit();

    await worker.onModuleDestroy();

    expect(mockWorkerClose).toHaveBeenCalled();
  });
});
