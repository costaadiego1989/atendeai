import type { SalesPaymentLink } from '@/shared/types';
import {
  createCommercialContext,
  getCommercialToneClassName,
  type CommercialKind,
  type CommercialTone,
} from '@/shared/commercial/commercial-context';

export type PaymentLinkCommercialContext = {
  kind: CommercialKind;
  kindLabel: string;
  statusLabel: string;
  channelLabel: string;
  tone: CommercialTone;
};

export function getPaymentLinkCommercialContext(
  item: Pick<SalesPaymentLink, 'externalId' | 'resourceType' | 'status'>,
): PaymentLinkCommercialContext {
  const externalId = String(item.externalId ?? '');
  const isRecovery = externalId.startsWith('recovery|');
  const isCheckoutCharge = item.resourceType === 'PAYMENT';

  if (isRecovery) {
    return createCommercialContext({
      kind: 'RECOVERY',
      statusLabel: item.status === 'PAID' ? 'Pagamento recuperado' : 'Recovery em andamento',
      channelLabel: 'Cobranca de recovery',
      summary: 'Pagamento associado a um fluxo de recovery.',
      tone: item.status === 'PAID' ? 'warning' : 'muted',
      evidenceSource: item.status === 'PAID' ? 'PAYMENT_CONFIRMED' : undefined,
    });
  }

  if (isCheckoutCharge) {
    return createCommercialContext({
      kind: 'CHECKOUT',
      statusLabel: item.status === 'PAID' ? 'Pagamento confirmado' : 'Checkout pendente',
      channelLabel: 'Checkout com pagamento',
      summary: 'Fluxo comercial vinculado a checkout ou pedido.',
      tone: item.status === 'PAID' ? 'success' : 'info',
      evidenceSource: item.status === 'PAID' ? 'PAYMENT_CONFIRMED' : undefined,
    });
  }

  return createCommercialContext({
    kind: 'PAYMENT_LINK',
    statusLabel: item.status === 'ACTIVE' ? 'Link ativo' : 'Link comercial',
    channelLabel: 'Link de pagamento',
    summary: 'Cobranca comercial sem classificacao de checkout ou recovery.',
    tone: item.status === 'PAID' ? 'success' : 'info',
    evidenceSource: item.status === 'PAID' ? 'PAYMENT_CONFIRMED' : undefined,
  });
}

export function getPaymentLinkCommercialToneClassName(
  tone: CommercialTone,
) {
  return getCommercialToneClassName(tone);
}
