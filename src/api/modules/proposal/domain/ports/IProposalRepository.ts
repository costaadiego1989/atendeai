import { Proposal } from '../entities/Proposal';

export interface IProposalRepository {
  save(proposal: Proposal): Promise<void>;
  findById(id: string): Promise<Proposal | null>;
  findByTenantId(tenantId: string): Promise<Proposal[]>;
  update(proposal: Proposal): Promise<void>;
  delete(id: string): Promise<void>;
}
