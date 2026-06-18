import { BadRequestException } from '@nestjs/common';
import { SendTenantManualWhatsAppUseCase } from '../application/use-cases/SendTenantManualWhatsAppUseCase';
import { PlatformAdminAuditService } from '../application/services/PlatformAdminAuditService';

describe('SendTenantManualWhatsAppUseCase', () => {
  const tenantId = 'tenant-uuid-001';

  function makeUsers(owner: { name: string; phone: string } | null) {
    return {
      findOwnerPrincipalByTenantId: jest.fn().mockResolvedValue(owner),
    };
  }

  function makeContacts(contactId = 'contact-uuid-001') {
    return {
      ensureContact: jest.fn().mockResolvedValue({ contactId }),
    };
  }

  function makeMessaging(result = { messageId: 'msg-001' }) {
    return {
      queueSystemMessage: jest.fn().mockResolvedValue(result),
    };
  }

  function makeAuditService() {
    return {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as PlatformAdminAuditService;
  }

  it('PADM-T-100: lança BadRequestException quando owner não existe', async () => {
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers(null) as any,
      makeContacts() as any,
      makeMessaging() as any,
      makeAuditService(),
    );
    await expect(
      uc.execute({ tenantId, text: 'Hello' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('PADM-T-101: envia mensagem com sucesso e chama ensureContact + queueSystemMessage', async () => {
    const contacts = makeContacts('c-42');
    const messaging = makeMessaging({ messageId: 'm-42' });
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers({ name: 'Alice', phone: '+5511999990000' }) as any,
      contacts as any,
      messaging as any,
      makeAuditService(),
    );
    const result = await uc.execute({ tenantId, text: 'Oi!' });

    expect(contacts.ensureContact).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, phone: '+5511999990000' }),
    );
    expect(messaging.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, contactId: 'c-42', channel: 'WHATSAPP' }),
    );
    expect(result).toEqual({ messageId: 'm-42' });
  });

  // ─── PA3: Audit logging ───────────────────────────────────────────────────────

  it('PADM-T-102: registra SEND_WHATSAPP no auditService em envio bem-sucedido', async () => {
    const audit = makeAuditService();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers({ name: 'Bob', phone: '+5511988880000' }) as any,
      makeContacts() as any,
      makeMessaging() as any,
      audit,
    );
    await uc.execute({ tenantId, text: 'Test message' });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SEND_WHATSAPP',
        tenantId,
        performedAt: expect.any(Date),
      }),
    );
  });

  it('PADM-T-103: não loga o texto da mensagem no audit (privacidade)', async () => {
    const audit = makeAuditService();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers({ name: 'Bob', phone: '+5511988880000' }) as any,
      makeContacts() as any,
      makeMessaging() as any,
      audit,
    );
    await uc.execute({ tenantId, text: 'private message content' });

    const auditArg = (audit.log as jest.Mock).mock.calls[0][0];
    // Text body must not appear verbatim in the audit payload
    expect(JSON.stringify(auditArg)).not.toContain('private message content');
  });

  // ─── PA4: Idempotency key on queue job ────────────────────────────────────────

  it('PADM-T-110: passa idempotencyKey ao queueSystemMessage', async () => {
    const messaging = makeMessaging();
    const uc = new SendTenantManualWhatsAppUseCase(
      makeUsers({ name: 'Carol', phone: '+5511977770000' }) as any,
      makeContacts('c-77') as any,
      messaging as any,
      makeAuditService(),
    );
    await uc.execute({ tenantId, text: 'Hello idempotency' });

    const call = (messaging.queueSystemMessage as jest.Mock).mock.calls[0][0];
    expect(call).toHaveProperty('idempotencyKey');
    expect(typeof call.idempotencyKey).toBe('string');
    expect(call.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('PADM-T-111: mesma (tenantId, phone, text) sempre gera o mesmo idempotencyKey', async () => {
    const messaging1 = makeMessaging();
    const messaging2 = makeMessaging();
    const owner = { name: 'Carol', phone: '+5511977770000' };

    const uc1 = new SendTenantManualWhatsAppUseCase(
      makeUsers(owner) as any,
      makeContacts() as any,
      messaging1 as any,
      makeAuditService(),
    );
    const uc2 = new SendTenantManualWhatsAppUseCase(
      makeUsers(owner) as any,
      makeContacts() as any,
      messaging2 as any,
      makeAuditService(),
    );

    await uc1.execute({ tenantId, text: 'Hello idempotency' });
    await uc2.execute({ tenantId, text: 'Hello idempotency' });

    const key1 = (messaging1.queueSystemMessage as jest.Mock).mock.calls[0][0].idempotencyKey;
    const key2 = (messaging2.queueSystemMessage as jest.Mock).mock.calls[0][0].idempotencyKey;
    expect(key1).toBe(key2);
  });

  it('PADM-T-112: texto diferente gera idempotencyKey diferente', async () => {
    const messaging1 = makeMessaging();
    const messaging2 = makeMessaging();
    const owner = { name: 'Carol', phone: '+5511977770000' };

    const uc1 = new SendTenantManualWhatsAppUseCase(
      makeUsers(owner) as any,
      makeContacts() as any,
      messaging1 as any,
      makeAuditService(),
    );
    const uc2 = new SendTenantManualWhatsAppUseCase(
      makeUsers(owner) as any,
      makeContacts() as any,
      messaging2 as any,
      makeAuditService(),
    );

    await uc1.execute({ tenantId, text: 'message A' });
    await uc2.execute({ tenantId, text: 'message B' });

    const key1 = (messaging1.queueSystemMessage as jest.Mock).mock.calls[0][0].idempotencyKey;
    const key2 = (messaging2.queueSystemMessage as jest.Mock).mock.calls[0][0].idempotencyKey;
    expect(key1).not.toBe(key2);
  });
});
