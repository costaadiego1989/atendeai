import type { RecoveryCase } from '@/shared/types';
import {
  createCommercialContext,
  getCommercialToneClassName,
  type CommercialTone,
} from '@/shared/commercial/commercial-context';

export type RecoveryCommercialContext = {
  kindLabel: string;
  statusLabel: string;
  summary: string;
  tone: CommercialTone;
};

export function getRecoveryCommercialContext(
  item: Pick<RecoveryCase, 'status' | 'paidAt' | 'amountDue'>,
): RecoveryCommercialContext {
  if (item.status === 'PAID' || item.paidAt) {
    return createCommercialContext({
      kind: 'RECOVERY',
      statusLabel: 'Pagamento recuperado',
      summary:
        'O pagamento foi confirmado neste fluxo de recovery e entra como receita recuperada.',
      tone: 'success',
      evidenceSource: 'PAYMENT_CONFIRMED',
    });
  }

  if (item.status === 'PROMISE_TO_PAY') {
    return createCommercialContext({
      kind: 'RECOVERY',
      kindLabel: 'Recovery em andamento',
      statusLabel: 'Promessa de pagamento',
      summary:
        'O cliente sinalizou pagamento, mas a receita ainda depende da confirmacao final.',
      tone: 'warning',
      badgeLabel: 'Recovery em andamento',
      confirmationLabel: 'Aguardando confirmacao final',
    });
  }

  if (item.status === 'NEGOTIATING' || item.status === 'CONTACTED') {
    return createCommercialContext({
      kind: 'RECOVERY',
      kindLabel: 'Recovery em andamento',
      statusLabel: 'Negociacao ativa',
      summary:
        'O caso esta em recuperacao ativa e ainda nao representa receita realizada.',
      tone: 'info',
      badgeLabel: 'Recovery em andamento',
      confirmationLabel: 'Aguardando avancos',
    });
  }

  return createCommercialContext({
    kind: 'RECOVERY',
    kindLabel: 'Recovery em aberto',
    statusLabel: 'Aguardando avancos',
    summary:
      'O caso ainda precisa de contato, cobranca ou confirmacao para virar receita recuperada.',
    tone: 'muted',
    badgeLabel: 'Recovery em aberto',
    confirmationLabel: 'Sem confirmacao ainda',
  });
}

export function getRecoveryCommercialToneClassName(
  tone: CommercialTone,
) {
  return getCommercialToneClassName(tone);
}
