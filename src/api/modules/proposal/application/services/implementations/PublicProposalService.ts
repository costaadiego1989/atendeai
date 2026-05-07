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
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { ProposalPublicLinkService } from './ProposalPublicLinkService';
import {
  normalizeProposalMetadata,
  resolveProposalFinalAmount,
} from '../../support/proposal-public-access';

type PublicProposalResponse = {
  id: string;
  branding: {
    companyName: string;
    logoUrl?: string | null;
  };
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
  signature?: {
    signerName?: string | null;
    signedAt?: string | null;
    hasSignature: boolean;
  };
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
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
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
    return this.acceptWithSignature(token, {});
  }

  async acceptWithSignature(
    token: string,
    input: { signerName?: string | null; signatureDataUrl?: string | null },
  ): Promise<PublicProposalResponse> {
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

    const signerName =
      typeof input.signerName === 'string' ? input.signerName.trim() : '';
    const signatureDataUrl =
      typeof input.signatureDataUrl === 'string'
        ? input.signatureDataUrl.trim()
        : '';

    if (!signerName) {
      throw new BadRequestException(
        'Informe o nome do signatário para concluir o aceite.',
      );
    }

    if (!signatureDataUrl.startsWith('data:image/')) {
      throw new BadRequestException(
        'A assinatura digital é obrigatória para concluir o aceite.',
      );
    }

    metadata.commercial.approval.status = 'ACCEPTED';
    metadata.commercial.approval.acceptedAt = new Date().toISOString();
    metadata.commercial.approval.signerName = signerName;
    metadata.commercial.approval.signatureDataUrl = signatureDataUrl;
    metadata.commercial.approval.signedAt =
      metadata.commercial.approval.acceptedAt;
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

  private async toPublicResponse(proposal: Proposal): Promise<PublicProposalResponse> {
    const metadata = normalizeProposalMetadata(proposal.metadata);
    const tenant = await this.tenantRepository.findById(proposal.tenantId);
    const brandingSource =
      metadata.branding && typeof metadata.branding === 'object'
        ? (metadata.branding as Record<string, unknown>)
        : null;
    const logoUrl =
      typeof brandingSource?.logoUrl === 'string' && brandingSource.logoUrl.trim()
        ? brandingSource.logoUrl.trim()
        : null;

    return {
      id: proposal.id,
      branding: {
        companyName: tenant?.companyName.value ?? 'Sua empresa',
        logoUrl,
      },
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
      signature: {
        signerName: metadata.commercial.approval.signerName ?? null,
        signedAt: metadata.commercial.approval.signedAt ?? null,
        hasSignature: Boolean(metadata.commercial.approval.signatureDataUrl),
      },
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
