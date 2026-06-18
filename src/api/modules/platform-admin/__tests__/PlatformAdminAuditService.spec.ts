import { Logger } from '@nestjs/common';
import { PlatformAdminAuditService } from '../application/services/PlatformAdminAuditService';

describe('PlatformAdminAuditService', () => {
  it('PADM-T-300: log emite JSON estruturado com todos os campos obrigatórios', () => {
    const service = new PlatformAdminAuditService();
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    service.log({
      action: 'SEND_WHATSAPP',
      tenantId: 'tenant-001',
      performedAt: new Date('2024-01-15T10:00:00.000Z'),
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg: string = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);

    expect(parsed).toMatchObject({
      action: 'SEND_WHATSAPP',
      tenantId: 'tenant-001',
      performedAt: '2024-01-15T10:00:00.000Z',
    });

    logSpy.mockRestore();
  });

  it('PADM-T-301: log aceita metadata extra', () => {
    const service = new PlatformAdminAuditService();
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    service.log({
      action: 'PLATFORM_QUOTA_ADJUST',
      tenantId: 'tenant-002',
      performedAt: new Date(),
      metadata: { messages: 10 },
    });

    const arg: string = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.metadata).toEqual({ messages: 10 });

    logSpy.mockRestore();
  });

  it('PADM-T-302: log sem tenantId ainda é válido (ações globais)', () => {
    const service = new PlatformAdminAuditService();
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    expect(() =>
      service.log({
        action: 'DRAFT_ADMIN_MESSAGE',
        performedAt: new Date(),
      }),
    ).not.toThrow();

    logSpy.mockRestore();
  });
});
