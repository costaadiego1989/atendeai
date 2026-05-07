import { PublicProposalService } from '../../application/services/implementations/PublicProposalService';
import { ProposalPublicLinkService } from '../../application/services/implementations/ProposalPublicLinkService';
import { buildProposal, InMemoryProposalRepository } from '../proposal-test-utils';

describe('PublicProposalService', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
      return undefined;
    },
  };
  const tenantRepository = {
    findById: jest.fn(async () => ({
      companyName: { value: 'Empresa Teste' },
    })),
  };

  it('returns the public proposal by token', async () => {
    const repository = new InMemoryProposalRepository();
    const proposal = buildProposal({ id: 'proposal-public-1' });
    repository.seed(proposal);

    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const service = new PublicProposalService(
      repository as any,
      tenantRepository as any,
      publicLinks,
      {} as any,
      {} as any,
    );

    const response = await service.getByToken(token);

    expect(response).toEqual(
      expect.objectContaining({
        id: proposal.id,
        branding: expect.objectContaining({
          companyName: 'Empresa Teste',
        }),
        title: proposal.title,
        approvalStatus: 'PENDING',
      }),
    );
  });

  it('accepts a proposal and generates a payment link', async () => {
    const repository = new InMemoryProposalRepository();
    const proposal = buildProposal({
      id: 'proposal-public-2',
      metadata: { finalPrice: 420 },
    });
    repository.seed(proposal);

    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const createSplitPaymentChargeUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: 'payment-link-1',
        paymentId: 'provider-payment-1',
        url: 'https://pay.test/charge/1',
        dueDate: '2026-05-10',
        status: 'ACTIVE',
      }),
    };

    const contacts = {
      getContactById: jest.fn().mockResolvedValue({
        contactId: proposal.contactId,
        name: 'Cliente Teste',
        phone: '5511999999999',
        document: '12345678901',
        branchId: 'branch-1',
      }),
    };

    const service = new PublicProposalService(
      repository as any,
      tenantRepository as any,
      publicLinks,
      createSplitPaymentChargeUseCase as any,
      contacts as any,
    );

    const response = await service.acceptWithSignature(token, {
      signerName: 'Cliente Teste',
      signatureDataUrl: 'data:image/png;base64,signature',
    });

    expect(createSplitPaymentChargeUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: proposal.tenantId,
        contactId: proposal.contactId,
        value: 420,
        sendViaWhatsApp: true,
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        approvalStatus: 'ACCEPTED',
        payment: expect.objectContaining({
          url: 'https://pay.test/charge/1',
        }),
      }),
    );
  });

  it('rejects a pending proposal', async () => {
    const repository = new InMemoryProposalRepository();
    const proposal = buildProposal({ id: 'proposal-public-3' });
    repository.seed(proposal);

    const publicLinks = new ProposalPublicLinkService(repository as any, configService as any);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const service = new PublicProposalService(
      repository as any,
      tenantRepository as any,
      publicLinks,
      {} as any,
      {} as any,
    );

    const response = await service.reject(token);

    expect(response).toEqual(
      expect.objectContaining({
        approvalStatus: 'REJECTED',
        status: 'REJECTED',
      }),
    );
  });
});
