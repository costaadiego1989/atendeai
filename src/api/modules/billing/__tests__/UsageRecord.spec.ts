import { UsageRecord } from '../domain/entities/UsageRecord';
import { TenantId } from '@shared/domain/TenantId';

describe('UsageRecord', () => {
  it('should start a new cycle with zeroed counters', () => {
    const usage = UsageRecord.create(
      TenantId.create('tenant-1'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );

    expect(usage.messagesUsed).toBe(0);
    expect(usage.aiTokensUsed).toBe(0);
    expect(usage.contactsUsed).toBe(0);
  });

  it('should increment the messages counter', () => {
    const usage = UsageRecord.create(
      TenantId.create('tenant-1'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );

    usage.recordMessage();
    usage.recordMessage();

    expect(usage.messagesUsed).toBe(2);
  });

  it('should accumulate AI tokens', () => {
    const usage = UsageRecord.create(
      TenantId.create('tenant-1'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );

    usage.recordTokens(300);
    usage.recordTokens(200);

    expect(usage.aiTokensUsed).toBe(500);
  });

  it('should increment contact usage', () => {
    const usage = UsageRecord.create(
      TenantId.create('tenant-1'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z'),
    );

    usage.recordContact();

    expect(usage.contactsUsed).toBe(1);
  });
});
