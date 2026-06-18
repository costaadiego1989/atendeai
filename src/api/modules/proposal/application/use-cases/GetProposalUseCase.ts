import { GetProposalService } from '../services/implementations/GetProposalService';

export class GetProposalUseCase {
  constructor(private readonly getProposalService: GetProposalService) {}

  async execute(id: string, tenantId: string) {
    const proposal = await this.getProposalService.execute(id, tenantId);
    return proposal.toJSON();
  }
}
