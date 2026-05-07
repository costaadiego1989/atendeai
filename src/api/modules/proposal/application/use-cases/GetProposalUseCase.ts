import { GetProposalService } from '../services/implementations/GetProposalService';

export class GetProposalUseCase {
  constructor(private readonly getProposalService: GetProposalService) {}

  async execute(id: string) {
    const proposal = await this.getProposalService.execute(id);
    return proposal.toJSON();
  }
}
