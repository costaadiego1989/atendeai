import { describe, expect, it } from 'vitest';
import type { ProposalRecord } from '../types';
import { getProposalCommercialJourney } from './proposal-commercial';

function createProposal(
  metadata?: Record<string, unknown> | null,
): ProposalRecord {
  return {
    id: 'proposal-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    userId: 'user-1',
    title: 'Proposta comercial',
    items: [],
    totalAmount: 100,
    status: 'DRAFT',
    metadata: metadata ?? null,
    createdAt: '2026-05-06T18:00:00.000Z',
    updatedAt: '2026-05-06T18:00:00.000Z',
  };
}

describe('getProposalCommercialJourney', () => {
  it('maps a proposal ready for acceptance when the public contract already exists', () => {
    const proposal = createProposal({
      commercial: {
        publicAccess: {
          publicUrl: 'https://app.atende.ai/public/proposals/token-1',
        },
        approval: {
          status: 'PENDING',
        },
      },
    });

    expect(getProposalCommercialJourney(proposal)).toEqual(
      expect.objectContaining({
        contract: expect.objectContaining({
          label: 'Contrato publico pronto',
          tone: 'info',
          visible: true,
        }),
        approval: expect.objectContaining({
          label: 'Aguardando aceite',
          tone: 'warning',
          visible: true,
        }),
        payment: expect.objectContaining({
          label: 'Pagamento pendente',
          tone: 'muted',
          visible: true,
        }),
      }),
    );
  });

  it('maps an accepted and paid proposal as completed commercial flow', () => {
    const proposal = createProposal({
      commercial: {
        publicAccess: {
          publicUrl: 'https://app.atende.ai/public/proposals/token-2',
        },
        approval: {
          status: 'ACCEPTED',
        },
        payment: {
          status: 'PAID',
        },
      },
    });

    expect(getProposalCommercialJourney(proposal)).toEqual(
      expect.objectContaining({
        contract: expect.objectContaining({
          label: 'Contrato publico pronto',
          tone: 'info',
        }),
        approval: expect.objectContaining({
          label: 'Aceita pelo cliente',
          tone: 'success',
        }),
        payment: expect.objectContaining({
          label: 'Pagamento confirmado',
          tone: 'success',
        }),
        summary:
          'Contrato enviado, aceite confirmado e pagamento registrado.',
      }),
    );
  });
});
