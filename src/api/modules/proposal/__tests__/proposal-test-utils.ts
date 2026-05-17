import { Proposal } from '../domain/entities/Proposal';
import { ProposalItem } from '../domain/value-objects/ProposalItem';
import { ProposalTitle } from '../domain/value-objects/ProposalTitle';
import { IProposalRepository } from '../domain/ports/IProposalRepository';
import { CreateProposalData } from '../application/services/implementations/CreateProposalService';
import { ProposalProps } from '../domain/entities/Proposal';

export function buildProposalItem(
  overrides: Partial<{
    name: string;
    quantity: number;
    unitPrice: number;
    description?: string;
  }> = {},
): ProposalItem {
  return ProposalItem.create({
    name: overrides.name ?? 'Plano Estratégico',
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 1500,
    description: overrides.description ?? 'Plano de execução comercial',
  });
}

export function buildProposal(
  overrides: Partial<ProposalProps> = {},
): Proposal {
  return Proposal.create({
    tenantId: overrides.tenantId ?? 'tenant-123',
    contactId: overrides.contactId ?? 'contact-456',
    userId: overrides.userId ?? 'user-789',
    title: overrides.title ?? ProposalTitle.create('Proposta Comercial'),
    description: overrides.description ?? 'Proposta comercial detalhada',
    benefits: overrides.benefits ?? 'Aceleração de vendas',
    items: overrides.items ?? [
      buildProposalItem({
        name: 'Diagnóstico inicial',
        quantity: 1,
        unitPrice: 1000,
      }),
      buildProposalItem({
        name: 'Execução assistida',
        quantity: 1,
        unitPrice: 2500,
      }),
    ],
    status: overrides.status,
    validUntil:
      overrides.validUntil ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    scheduledAt: overrides.scheduledAt ?? null,
    pdfUrl: overrides.pdfUrl ?? null,
    notes: overrides.notes ?? null,
    metadata: overrides.metadata ?? { source: 'test' },
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    id: overrides.id,
    totalAmount: overrides.totalAmount,
  });
}

export function buildCreateProposalData(
  overrides: Partial<CreateProposalData> = {},
): CreateProposalData {
  return {
    tenantId: overrides.tenantId ?? 'tenant-123',
    contactId: overrides.contactId ?? 'contact-456',
    userId: overrides.userId ?? 'user-789',
    title: overrides.title ?? 'Proposta Comercial',
    description: overrides.description ?? 'Proposta comercial detalhada',
    benefits: overrides.benefits ?? 'Aceleração de vendas',
    items: overrides.items ?? [
      {
        name: 'Diagnóstico inicial',
        quantity: 1,
        unitPrice: 1000,
        description: 'Entrada',
      },
      {
        name: 'Execução assistida',
        quantity: 1,
        unitPrice: 2500,
        description: 'Entrega',
      },
    ],
    validUntil:
      overrides.validUntil ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

export function createProposalRepositoryMock(): jest.Mocked<IProposalRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByTenantId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

export class InMemoryProposalRepository implements IProposalRepository {
  private readonly store = new Map<string, Proposal>();

  async save(proposal: Proposal): Promise<void> {
    this.store.set(proposal.id, proposal);
  }

  async findById(id: string): Promise<Proposal | null> {
    return this.store.get(id) ?? null;
  }

  async findByTenantId(tenantId: string): Promise<Proposal[]> {
    return [...this.store.values()].filter(
      (proposal) => proposal.tenantId === tenantId,
    );
  }

  async update(proposal: Proposal): Promise<void> {
    this.store.set(proposal.id, proposal);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  seed(proposal: Proposal): void {
    this.store.set(proposal.id, proposal);
  }

  getAll(): Proposal[] {
    return [...this.store.values()];
  }
}

export function createQueueMock() {
  const jobs: Array<{
    name: string;
    data: unknown;
    options?: Record<string, unknown>;
  }> = [];

  return {
    jobs,
    add: jest.fn(
      async (
        name: string,
        data: unknown,
        options?: Record<string, unknown>,
      ) => {
        jobs.push({ name, data, options });
        return { name, data, options };
      },
    ),
  };
}

export function createFileStorageMock() {
  return {
    upload: jest.fn(async () => 'https://cdn.test/proposals/proposal.pdf'),
    delete: jest.fn(async () => undefined),
    getPresignedUrl: jest.fn(async () => 'https://cdn.test/presigned'),
  };
}

export function createMessagingFacadeMock() {
  return {
    queueSystemMessage: jest.fn(async () => ({
      conversationId: 'conversation-123',
      messageId: 'message-123',
    })),
  };
}
