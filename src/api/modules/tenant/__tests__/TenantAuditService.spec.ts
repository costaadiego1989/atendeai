import { TenantAuditService } from '../application/services/TenantAuditService.js';
import {
  ITenantAuditLogRepository,
  TenantAuditLogInput,
} from '../domain/repositories/ITenantAuditLogRepository.js';

describe('TenantAuditService', () => {
  let service: TenantAuditService;
  let repository: jest.Mocked<ITenantAuditLogRepository>;

  beforeEach(() => {
    repository = {
      record: jest.fn(),
      listRecent: jest.fn(),
    };

    service = new TenantAuditService(repository);
  });

  it('should record an audit log successfully', async () => {
    const input: TenantAuditLogInput = {
      tenantId: 'tenant-1',
      eventType: 'BRANCH_ADDED',
      userId: 'user-1',
      metadata: { key: 'value' },
    };

    await service.record(input);

    expect(repository.record).toHaveBeenCalledWith(input);
  });

  it('should not throw error and just log a warning if repository fails', async () => {
    repository.record.mockRejectedValue(new Error('Database error'));

    // We expect it NOT to throw, as it has a try-catch block
    await expect(
      service.record({
        tenantId: 'tenant-1',
        eventType: 'AI_CONFIG_UPDATED',
      }),
    ).resolves.not.toThrow();

    expect(repository.record).toHaveBeenCalled();
  });
});
