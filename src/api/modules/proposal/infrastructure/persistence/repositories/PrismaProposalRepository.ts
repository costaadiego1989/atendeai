import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { Proposal as PrismaProposal } from '@prisma/client';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import { ProposalMapper } from '../mappers/ProposalMapper';

@Injectable()
export class PrismaProposalRepository implements IProposalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(proposal: Proposal): Promise<void> {
    const data = ProposalMapper.toPersistence(proposal);
    await this.prisma.proposal.create({
      data: {
        id: data.id,
        tenantId: data.tenantId,
        contactId: data.contactId,
        userId: data.userId,
        title: data.title,
        description: data.description,
        benefits: data.benefits,
        items: data.items,
        totalAmount: data.totalAmount,
        status: data.status,
        validUntil: data.validUntil,
        scheduledAt: data.scheduledAt,
        pdfUrl: data.pdfUrl,
        notes: data.notes,
        metadata: data.metadata,
      },
    });
  }

  async findById(id: string): Promise<Proposal | null> {
    const raw = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!raw) return null;

    return ProposalMapper.toDomain(raw);
  }

  async findByTenantId(tenantId: string): Promise<Proposal[]> {
    const raws = await this.prisma.proposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return raws.map((raw: PrismaProposal) => ProposalMapper.toDomain(raw));
  }

  async update(proposal: Proposal): Promise<void> {
    const data = ProposalMapper.toPersistence(proposal);
    await this.prisma.proposal.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description,
        benefits: data.benefits,
        items: data.items,
        totalAmount: data.totalAmount,
        status: data.status,
        validUntil: data.validUntil,
        scheduledAt: data.scheduledAt,
        pdfUrl: data.pdfUrl,
        notes: data.notes,
        metadata: data.metadata,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.proposal.delete({
      where: { id },
    });
  }
}
