import { describe, expect, it } from 'vitest';
import type { SalesPaymentLink } from '@/shared/types';
import {
  getPaymentLinkCommercialContext,
  getPaymentLinkCommercialToneClassName,
} from './payment-link-commercial';

function createLink(overrides?: Partial<SalesPaymentLink>): SalesPaymentLink {
  return {
    id: 'link-1',
    name: 'Pagamento teste',
    value: 120,
    url: 'https://pay.test/link-1',
    billingType: 'PIX',
    status: 'ACTIVE',
    source: 'MANUAL',
    resourceType: 'PAYMENT_LINK',
    createdAt: '2026-05-06T18:00:00.000Z',
    updatedAt: '2026-05-06T18:00:00.000Z',
    ...overrides,
  };
}

describe('payment-link-commercial', () => {
  it('classifies recovery links from externalId', () => {
    const context = getPaymentLinkCommercialContext(
      createLink({
        externalId: 'recovery|tenant-1|link-1',
        resourceType: 'PAYMENT',
        status: 'PAID',
      }),
    );

    expect(context).toEqual(
      expect.objectContaining({
        kind: 'RECOVERY',
        kindLabel: 'Receita recuperada',
        statusLabel: 'Pagamento recuperado',
        channelLabel: 'Cobranca de recovery',
      }),
    );
  });

  it('classifies checkout charges from payment resource type', () => {
    const context = getPaymentLinkCommercialContext(
      createLink({
        externalId: 'sales-charge|tenant-1|link-2',
        resourceType: 'PAYMENT',
        status: 'PAID',
      }),
    );

    expect(context).toEqual(
      expect.objectContaining({
        kind: 'CHECKOUT',
        kindLabel: 'Nova venda',
        statusLabel: 'Pagamento confirmado',
        channelLabel: 'Checkout com pagamento',
      }),
    );
  });

  it('keeps manual links as generic cobranca comercial', () => {
    const context = getPaymentLinkCommercialContext(
      createLink({
        externalId: 'payment-link|tenant-1|link-3',
        resourceType: 'PAYMENT_LINK',
        status: 'ACTIVE',
      }),
    );

    expect(context).toEqual(
      expect.objectContaining({
        kind: 'PAYMENT_LINK',
        kindLabel: 'Cobranca comercial',
        statusLabel: 'Link ativo',
        channelLabel: 'Link de pagamento',
      }),
    );
    expect(getPaymentLinkCommercialToneClassName(context.tone)).toContain('sky');
  });
});
