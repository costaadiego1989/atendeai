import { DraftTenantAdminMessageUseCase } from '../application/use-cases/DraftTenantAdminMessageUseCase';
import { PlatformAdminAuditService } from '../application/services/PlatformAdminAuditService';

describe('DraftTenantAdminMessageUseCase', () => {
  function makeAI(text = 'draft result') {
    return {
      generateResponse: jest.fn().mockResolvedValue({ text }),
    };
  }

  function makeAudit() {
    return {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as PlatformAdminAuditService;
  }

  it('PADM-T-200: gera rascunho e retorna texto trimado', async () => {
    const uc = new DraftTenantAdminMessageUseCase(makeAI('  hello  ') as any, makeAudit());
    const result = await uc.execute({
      intent: 'QUOTA_WARNING',
      locale: 'pt-BR',
      tenantSummary: 'summary',
    });
    expect(result.text).toBe('hello');
  });

  // ─── PA3: Audit logging ───────────────────────────────────────────────────────

  it('PADM-T-201: registra DRAFT_ADMIN_MESSAGE no auditService', async () => {
    const audit = makeAudit();
    const uc = new DraftTenantAdminMessageUseCase(makeAI() as any, audit);
    await uc.execute({
      intent: 'CUSTOM',
      locale: 'pt-BR',
      tenantSummary: 'tenant ctx',
      operatorHint: 'send promotion',
    });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAFT_ADMIN_MESSAGE',
        performedAt: expect.any(Date),
      }),
    );
  });
});
