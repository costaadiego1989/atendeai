const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();
const mockQueueClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    close: mockQueueClose,
  })),
}));

import { ConfigService } from '@nestjs/config';
import { FollowUpAuditService } from '@modules/messaging/application/services/FollowUpAuditService';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';

describe('FollowUpService', () => {
  let service: FollowUpService;
  let configService: jest.Mocked<ConfigService>;
  let followUpAuditService: jest.Mocked<FollowUpAuditService>;

  beforeEach(() => {
    mockQueueAdd.mockReset();
    mockQueueGetJob.mockReset();
    mockQueueClose.mockReset();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    } as unknown as jest.Mocked<ConfigService>;

    followUpAuditService = {
      record: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<FollowUpAuditService>;

    service = new FollowUpService(configService, followUpAuditService);
  });

  it('should reschedule follow-ups with deterministic job ids and audit trail', async () => {
    mockQueueGetJob.mockResolvedValue(null);

    await service.scheduleFollowUps('conversation-1', 'tenant-1', 'contact-1');

    expect(mockQueueAdd).toHaveBeenCalledTimes(4);
    expect(mockQueueAdd).toHaveBeenNthCalledWith(
      1,
      'send-follow-up',
      {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        interval: '1h',
      },
      expect.objectContaining({
        delay: 60 * 60 * 1000,
        jobId: 'follow-up:conversation-1:1h',
        removeOnComplete: true,
      }),
    );
    expect(followUpAuditService.record).toHaveBeenCalledTimes(4);
    expect(followUpAuditService.record).toHaveBeenNthCalledWith(
      1,
      'conversation-1',
      '1h',
      'SCHEDULED',
    );
  });

  it('should cancel existing follow-up jobs and record the cancellation reason', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    mockQueueGetJob
      .mockResolvedValueOnce({ remove })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ remove })
      .mockResolvedValueOnce(null);

    await service.cancelFollowUps('conversation-1', 'human-message-sent');

    expect(mockQueueGetJob).toHaveBeenCalledTimes(4);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(followUpAuditService.record).toHaveBeenCalledTimes(2);
    expect(followUpAuditService.record).toHaveBeenCalledWith(
      'conversation-1',
      '1h',
      'CANCELLED',
      'human-message-sent',
    );
    expect(followUpAuditService.record).toHaveBeenCalledWith(
      'conversation-1',
      '1d',
      'CANCELLED',
      'human-message-sent',
    );
  });

  it('should close the underlying queue on module destroy', async () => {
    await service.onModuleDestroy();

    expect(mockQueueClose).toHaveBeenCalled();
  });
});
