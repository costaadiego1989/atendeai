import { describe, expect, it } from 'vitest';
import {
  createCommercialContext,
  getCommercialKindLabel,
  getCommercialToneClassName,
} from './commercial-context';

describe('commercial-context', () => {
  it('derives recovery metadata from the shared mapper', () => {
    expect(
      createCommercialContext({
        kind: 'RECOVERY',
        statusLabel: 'Pagamento recuperado',
        summary: 'Resumo teste',
        tone: 'warning',
        evidenceSource: 'PAYMENT_CONFIRMED',
      }),
    ).toEqual(
      expect.objectContaining({
        kindLabel: 'Receita recuperada',
        isRecovery: true,
        isObjectiveEvidence: true,
        confirmationLabel: 'Confirmado por webhook de pagamento',
      }),
    );
  });

  it('maps the shared kind labels used across the app', () => {
    expect(getCommercialKindLabel('NEW_SALE')).toBe('Nova venda');
    expect(getCommercialKindLabel('PAYMENT_LINK')).toBe('Cobranca comercial');
    expect(getCommercialKindLabel('PROPOSAL')).toBe('Proposta comercial');
  });

  it('keeps the shared tone mapping centralized', () => {
    expect(getCommercialToneClassName('success')).toContain('emerald');
    expect(getCommercialToneClassName('muted')).toContain('muted-foreground');
  });
});
