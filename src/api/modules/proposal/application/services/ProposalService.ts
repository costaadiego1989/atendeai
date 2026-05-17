import { Inject, Injectable, Logger } from '@nestjs/common';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import { ProposalTitle } from '@modules/proposal/domain/value-objects/ProposalTitle';
import { ProposalItem } from '@modules/proposal/domain/value-objects/ProposalItem';
import { S3StorageService } from '@shared/infrastructure/services/S3StorageService';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ProposalNotFoundError } from '@modules/proposal/domain/errors/ProposalNotFoundError';
import { ProposalInvalidScheduleDateError } from '@modules/proposal/domain/errors/ProposalInvalidScheduleDateError';

export interface CreateProposalData {
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  items: any[];
  validUntil?: Date | null;
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name);

  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    private readonly storageService: S3StorageService,
    @InjectQueue('proposal-delivery') private readonly deliveryQueue: Queue,
  ) {}

  async create(data: CreateProposalData): Promise<Proposal> {
    const title = ProposalTitle.create(data.title);
    const items = data.items.map((item) =>
      ProposalItem.create({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description,
      }),
    );

    const proposal = Proposal.create({
      tenantId: data.tenantId,
      contactId: data.contactId,
      userId: data.userId,
      title,
      description: data.description,
      benefits: data.benefits,
      items,
      validUntil: data.validUntil,
    });

    await this.proposalRepository.save(proposal);
    return proposal;
  }

  async update(
    id: string,
    data: Partial<CreateProposalData>,
  ): Promise<Proposal> {
    const proposal = await this.getById(id);

    if (data.title) {
      (proposal as any)._props.title = ProposalTitle.create(data.title);
    }

    if (data.items) {
      const items = data.items.map((item) =>
        ProposalItem.create({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          description: item.description,
        }),
      );
      proposal.updateItems(items);
    }

    if (data.description !== undefined)
      (proposal as any)._props.description = data.description;
    if (data.benefits !== undefined)
      (proposal as any)._props.benefits = data.benefits;
    if (data.validUntil !== undefined)
      (proposal as any)._props.validUntil = data.validUntil;

    await this.proposalRepository.update(proposal);
    return proposal;
  }

  async delete(id: string): Promise<void> {
    await this.proposalRepository.delete(id);
  }

  async getById(id: string): Promise<Proposal> {
    const proposal = await this.proposalRepository.findById(id);
    if (!proposal) throw new ProposalNotFoundError(id);
    return proposal;
  }

  async listByTenant(tenantId: string): Promise<Proposal[]> {
    return this.proposalRepository.findByTenantId(tenantId);
  }

  async scheduleDelivery(id: string, scheduledAt: Date): Promise<void> {
    const proposal = await this.getById(id);

    if (scheduledAt <= new Date()) {
      throw new ProposalInvalidScheduleDateError();
    }

    proposal.markAsScheduled(scheduledAt);
    await this.proposalRepository.update(proposal);

    const delay = scheduledAt.getTime() - Date.now();
    await this.deliveryQueue.add(
      'send-proposal',
      { proposalId: id },
      { delay: delay > 0 ? delay : 0, jobId: `send-proposal-${id}` },
    );
  }
}
