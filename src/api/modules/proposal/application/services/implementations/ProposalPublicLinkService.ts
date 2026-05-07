import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import {
  buildProposalPublicToken,
  normalizeProposalMetadata,
  verifyProposalPublicToken,
} from '../../support/proposal-public-access';

@Injectable()
export class ProposalPublicLinkService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    private readonly configService: ConfigService,
  ) {}

  async ensurePublicLink(proposal: Proposal): Promise<{
    token: string;
    publicUrl: string;
  }> {
    const metadata = normalizeProposalMetadata(proposal.metadata);
    const token = buildProposalPublicToken(
      {
        proposalId: proposal.id,
        tokenId: metadata.commercial.publicAccess.tokenId,
      },
      this.resolveSecret(),
    );
    const publicUrl = `${this.resolvePublicBaseUrl()}/proposal/${token}`;

    if (metadata.commercial.publicAccess.publicUrl !== publicUrl) {
      metadata.commercial.publicAccess.publicUrl = publicUrl;
      proposal.setMetadata(metadata);
      await this.proposalRepository.update(proposal);
    }

    return { token, publicUrl };
  }

  async resolveProposalByToken(token: string): Promise<Proposal | null> {
    const payload = verifyProposalPublicToken(token, this.resolveSecret());
    if (!payload) {
      return null;
    }

    const proposal = await this.proposalRepository.findById(payload.proposalId);
    if (!proposal) {
      return null;
    }

    const metadata = normalizeProposalMetadata(proposal.metadata);
    if (metadata.commercial.publicAccess.tokenId !== payload.tokenId) {
      return null;
    }

    return proposal;
  }

  private resolveSecret(): string {
    return (
      this.configService.get<string>('PROPOSAL_PUBLIC_SECRET') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'proposal-public-secret'
    );
  }

  private resolvePublicBaseUrl(): string {
    const configuredBase =
      this.configService.get<string>('WEB_PUBLIC_BASE_URL') ||
      this.configService.get<string>('APP_PUBLIC_BASE_URL');

    if (configuredBase?.trim()) {
      return configuredBase.replace(/\/$/, '');
    }

    return 'http://localhost:8080';
  }
}
