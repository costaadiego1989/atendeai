import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CONTACT_FACADE, IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { CreateSplitPaymentChargeUseCase } from '@modules/sales/application/use-cases/CreateSplitPaymentChargeUseCase';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';
import { ProposalPublicLinkService } from './ProposalPublicLinkService';
import {
  normalizeProposalMetadata,
  resolveProposalFinalAmount,
} from '../../support/proposal-public-access';

type PublicProposalResponse = {
  id: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    description?: string | null;
  }>;
  totalAmount: number;
  finalAmount: number;
  validUntil?: string | null;
  status: string;
  approvalStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  payment?: {
    id?: string;
    paymentId?: string;
    url?: string;
    status?: string;
    dueDate?: string;
  };
};

@Injectable()
export class PublicProposalService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    private readonly publicLinks: ProposalPublicLinkService,
    private readonly createSplitPaymentChargeUseCase: CreateSplitPaymentChargeUseCase,
    @Inject(CONTACT_FACADE)
    private readonly contacts: IContactFacade,
  ) {}

  async getByToken(token: string): Promise<PublicProposalResponse> {
    const proposal = await this.resolveProposalOrThrow(token);
    await this.publicLinks.ensurePublicLink(proposal);
    return this.toPublicResponse(proposal);
  }

  async accept(token: string): Promise<PublicProposalResponse> {
    const proposal = await this.resolveProposalOrThrow(token);
    const metadata = normalizeProposalMetadata(proposal.metadata);

    if (metadata.commercial.approval.status === 'REJECTED') {
      throw new BadRequestException('Esta proposta já foi recusada pelo cliente.');
    }

    if (!metadata.commercial.payment?.url) {
      const contact = await this.contacts.getContactById(proposal.tenantId, proposal.contactId);
      if (!contact) {
        throw new NotFoundException('Contato da proposta não foi encontrado.');
      }

      if (!contact.document?.replace(/\D/g, '')) {
        throw new BadRequestException(
          'Esta proposta ainda não pode gerar pagamento porque o cliente não possui CPF ou CNPJ cadastrado.',
        );
      }

      const amount = resolveProposalFinalAmount(proposal);
      const payment = await this.createSplitPaymentChargeUseCase.execute({
        tenantId: proposal.tenantId,
        branchId: contact.branchId ?? null,
        contactId: proposal.contactId,
        conversationId: metadata.commercial.publicAccess.conversationId ?? null,
        customerDocument: contact.document,
        name: proposal.title,
        value: amount,
        description: proposal.description || `Pagamento referente à proposta "${proposal.title}"`,
        label: 'Proposta aceita',
        billingType: 'PIX',
        dueDate: proposal.validUntil ?? undefined,
        sendViaWhatsApp: true,
      });

      metadata.commercial.payment = {
        id: payment.id,
        paymentId: payment.paymentId,
        url: payment.url,
        status: payment.status,
        dueDate: payment.dueDate,
      };
    }

    metadata.commercial.approval.status = 'ACCEPTED';
    metadata.commercial.approval.acceptedAt = new Date().toISOString();
    proposal.updateStatus('ACCEPTED');
    proposal.setMetadata(metadata);
    await this.proposalRepository.update(proposal);

    return this.toPublicResponse(proposal);
  }

  async reject(token: string): Promise<PublicProposalResponse> {
    const proposal = await this.resolveProposalOrThrow(token);
    const metadata = normalizeProposalMetadata(proposal.metadata);

    if (metadata.commercial.approval.status === 'ACCEPTED') {
      throw new BadRequestException('Esta proposta já foi aceite e não pode mais ser recusada.');
    }

    metadata.commercial.approval.status = 'REJECTED';
    metadata.commercial.approval.rejectedAt = new Date().toISOString();
    proposal.updateStatus('REJECTED');
    proposal.setMetadata(metadata);
    await this.proposalRepository.update(proposal);

    return this.toPublicResponse(proposal);
  }

  private async resolveProposalOrThrow(token: string): Promise<Proposal> {
    const proposal = await this.publicLinks.resolveProposalByToken(token);
    if (!proposal) {
      throw new NotFoundException('Proposta pública não encontrada ou expirada.');
    }

    return proposal;
  }

  private toPublicResponse(proposal: Proposal): PublicProposalResponse {
    const metadata = normalizeProposalMetadata(proposal.metadata);

    return {
      id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      benefits: proposal.benefits,
      items: proposal.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        description: item.description ?? null,
      })),
      totalAmount: proposal.totalAmount,
      finalAmount: resolveProposalFinalAmount(proposal),
      validUntil: proposal.validUntil ? proposal.validUntil.toISOString() : null,
      status: proposal.status,
      approvalStatus: metadata.commercial.approval.status,
      payment: metadata.commercial.payment
        ? {
            id: metadata.commercial.payment.id,
            paymentId: metadata.commercial.payment.paymentId,
            url: metadata.commercial.payment.url,
            status: metadata.commercial.payment.status,
            dueDate: metadata.commercial.payment.dueDate,
          }
        : undefined,
    };
  }
}
