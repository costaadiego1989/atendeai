import { Proposal as PrismaProposal } from '@prisma/client';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';
import { ProposalItem } from '@modules/proposal/domain/value-objects/ProposalItem';
import { ProposalTitle } from '@modules/proposal/domain/value-objects/ProposalTitle';
import { Decimal } from '@prisma/client/runtime/library';

export class ProposalMapper {
  static toDomain(raw: PrismaProposal): Proposal {
    const items = Array.isArray(raw.items)
      ? raw.items.map((item: any) =>
          ProposalItem.create({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            description: item.description,
          }),
        )
      : [];

    return Proposal.create({
      id: raw.id,
      tenantId: raw.tenantId,
      contactId: raw.contactId,
      userId: raw.userId,
      title: ProposalTitle.create(raw.title),
      description: raw.description,
      benefits: raw.benefits,
      items,
      status: raw.status as any,
      validUntil: raw.validUntil,
      scheduledAt: raw.scheduledAt,
      pdfUrl: raw.pdfUrl,
      notes: raw.notes,
      metadata: raw.metadata as any,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toPersistence(proposal: Proposal): any {
    const json = proposal.toJSON();
    return {
      id: json.id,
      tenantId: json.tenantId,
      contactId: json.contactId,
      userId: json.userId,
      title: json.title,
      description: json.description,
      benefits: json.benefits,
      items: json.items,
      totalAmount: new Decimal(json.totalAmount || 0),
      status: json.status,
      validUntil: json.validUntil,
      scheduledAt: json.scheduledAt,
      pdfUrl: json.pdfUrl,
      notes: json.notes,
      metadata: json.metadata,
      created_at: json.createdAt,
      updated_at: json.updatedAt,
    };
  }
}
