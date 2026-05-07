import { ListProposalsService } from '../services/implementations/ListProposalsService';

export class ListProposalsUseCase {
  constructor(private readonly listProposalsService: ListProposalsService) {}

  async execute(tenantId: string) {
    const proposals = await this.listProposalsService.execute(tenantId);
    return proposals.map(p => p.toJSON());
  }
}
