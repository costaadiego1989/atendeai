import { describe, expect, it } from 'vitest';
import type { RecoveryCase } from '@/shared/types';
import { getRecoveryCommercialContext } from './recovery-commercial';

function createCase(overrides?: Partial<RecoveryCase>): RecoveryCase {
  return {
    id: 'recovery-1',
    debtorName: 'Cliente em atraso',
    phone: '5511999999999',
    source: 'CRM',
    status: 'READY_TO_CONTACT',
    createdAt: '2026-05-06T18:00:00.000Z',
    updatedAt: '2026-05-06T18:00:00.000Z',
    ...overrides,
  };
}

describe('getRecoveryCommercialContext', () => {
  it('marks paid recovery as recovered revenue', () => {
    expect(
      getRecoveryCommercialContext(
        createCase({
          status: 'PAID',
          amountDue: 240,
          paidAt: '2026-05-06T20:00:00.000Z',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kindLabel: 'Receita recuperada',
        statusLabel: 'Pagamento recuperado',
        summary:
          'O pagamento foi confirmado neste fluxo de recovery e entra como receita recuperada.',
        tone: 'success',
      }),
    );
  });

  it('marks promise to pay as waiting for recovered revenue', () => {
    expect(
      getRecoveryCommercialContext(
        createCase({
          status: 'PROMISE_TO_PAY',
          amountDue: 120,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kindLabel: 'Recovery em andamento',
        statusLabel: 'Promessa de pagamento',
        tone: 'warning',
      }),
    );
  });
});
