import { describe, expect, it } from 'vitest';
import {
  getSaleAttributionMeta,
  getSaleAttributionDialogCopy,
  getSaleAttributionToastCopy,
} from './sale-attribution-ui';

describe('sale-attribution-ui', () => {
  it('returns recovery metadata for recovered revenue', () => {
    expect(
      getSaleAttributionMeta({
        commercialKind: 'RECOVERY',
        commercialStatus: 'RECOVERED',
        evidenceSource: 'PAYMENT_CONFIRMED',
      }),
    ).toEqual(
      expect.objectContaining({
        kindLabel: 'Receita recuperada',
        statusLabel: 'Pagamento recuperado',
        accentClassName: expect.stringContaining('amber'),
        isRecovery: true,
        isObjectiveEvidence: true,
      }),
    );
  });

  it('returns new sale metadata for payment-confirmed commerce', () => {
    expect(
      getSaleAttributionMeta({
        commercialKind: 'NEW_SALE',
        commercialStatus: 'PAYMENT_CONFIRMED',
        evidenceSource: 'PAYMENT_CONFIRMED',
      }),
    ).toEqual(
      expect.objectContaining({
        kindLabel: 'Nova venda',
        statusLabel: 'Pagamento confirmado',
        isRecovery: false,
        isObjectiveEvidence: true,
      }),
    );
  });

  it('uses objective evidence copy in the dialog when the webhook is the source of truth', () => {
    expect(
      getSaleAttributionDialogCopy({
        commercialKind: 'NEW_SALE',
        evidenceSource: 'PAYMENT_CONFIRMED',
      }),
    ).toEqual(
      expect.objectContaining({
        title: 'Confirmar venda',
        submitLabel: 'Confirmar venda',
      }),
    );
  });

  it('uses recovery toast copy when the payment belongs to recovery', () => {
    expect(
      getSaleAttributionToastCopy({
        approved: false,
        commercialKind: 'RECOVERY',
        commercialStatus: 'RECOVERED',
      }),
    ).toEqual({
      title: 'Receita recuperada',
      description:
        'Esse pagamento foi contabilizado como recovery. Ele nao entra como nova venda.',
      variant: 'default',
    });
  });
});
