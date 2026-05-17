import { Proposal } from '../Proposal';
import { ProposalEmptyItemsError } from '../../errors/ProposalEmptyItemsError';
import { ProposalTitleTooShortError } from '../../errors/ProposalTitleTooShortError';
import { ProposalItemNameRequiredError } from '../../errors/ProposalItemNameRequiredError';
import {
  buildProposal,
  buildProposalItem,
} from '../../../__tests__/proposal-test-utils';
import { ProposalTitle } from '../../value-objects/ProposalTitle';

describe('Proposal Entity', () => {
  it('creates a proposal with DRAFT status by default', () => {
    const proposal = buildProposal();

    expect(proposal.id).toBeDefined();
    expect(proposal.status).toBe('DRAFT');
    expect(proposal.totalAmount).toBe(3500);
  });

  it('keeps description and benefits', () => {
    const proposal = buildProposal({
      description: 'Otimização de fluxo comercial',
      benefits: 'Aumento de conversão',
    });

    expect(proposal.description).toBe('Otimização de fluxo comercial');
    expect(proposal.benefits).toBe('Aumento de conversão');
  });

  it('throws a domain error when scheduling without items', () => {
    const proposal = Proposal.create({
      tenantId: 'tenant-123',
      contactId: 'contact-456',
      userId: 'user-789',
      title: ProposalTitle.create('Proposta Comercial'),
      items: [],
    });

    expect(() =>
      proposal.markAsScheduled(new Date(Date.now() + 60_000)),
    ).toThrow(ProposalEmptyItemsError);
  });

  it('updates status to SCHEDULED when a valid date is provided', () => {
    const proposal = buildProposal();
    const scheduleDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

    proposal.markAsScheduled(scheduleDate);

    expect(proposal.status).toBe('SCHEDULED');
    expect(proposal.scheduledAt).toBe(scheduleDate);
  });

  it('recalculates total amount when items are updated', () => {
    const proposal = buildProposal();

    proposal.updateItems([
      buildProposalItem({ name: 'Item A', quantity: 2, unitPrice: 100 }),
      buildProposalItem({ name: 'Item B', quantity: 1, unitPrice: 300 }),
    ]);

    expect(proposal.totalAmount).toBe(500);
  });

  it('validates proposal title with a domain error', () => {
    expect(() => ProposalTitle.create('Ab')).toThrow(
      ProposalTitleTooShortError,
    );
  });

  it('validates proposal items with a domain error', () => {
    expect(() =>
      buildProposalItem({ name: '', quantity: 1, unitPrice: 10 }),
    ).toThrow(ProposalItemNameRequiredError);
  });
});
