import { applyRecoveryPlaybookTemplate, daysPastDue } from './recoveryPlaybookTemplate';
import { RecoveryCaseRecord } from '../../domain/ports/IRecoveryRepository';

function baseCase(over: Partial<RecoveryCaseRecord> = {}): RecoveryCaseRecord {
  return {
    id: 'c1',
    tenantId: 't1',
    debtorName: 'Maria',
    debtorCompanyName: 'Acme',
    phone: '+5511999999999',
    source: 'MANUAL',
    status: 'READY_TO_CONTACT',
    assignedTags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe('applyRecoveryPlaybookTemplate', () => {
  it('substitui placeholders conhecidos', () => {
    const text = applyRecoveryPlaybookTemplate(
      'Olá {{debtorName}}, valor {{amountDue}} venc. {{dueDate}} — {{chargeTitle}}',
      baseCase({
        chargeTitle: 'Mensalidade',
        amountDue: '120.50',
        dueDate: new Date('2026-04-01T00:00:00.000Z'),
      }),
    );
    expect(text).toContain('Maria');
    expect(text).toContain('120.50');
    expect(text).toContain('2026-04-01');
    expect(text).toContain('Mensalidade');
  });

  it('mantém chaves desconhecidas vazias', () => {
    expect(applyRecoveryPlaybookTemplate('{{unknown}}', baseCase())).toBe('');
  });
});

describe('daysPastDue', () => {
  it('retorna dias completos em UTC quando já venceu', () => {
    const due = new Date('2026-05-01T12:00:00.000Z');
    const now = new Date('2026-05-03T12:00:00.000Z');
    expect(daysPastDue(due, now)).toBe(2);
  });

  it('retorna 0 se não há data ou não está em atraso', () => {
    expect(daysPastDue(null, new Date())).toBe(0);
    const future = new Date('2030-01-01');
    expect(daysPastDue(future, new Date('2026-01-01'))).toBe(0);
  });
});
