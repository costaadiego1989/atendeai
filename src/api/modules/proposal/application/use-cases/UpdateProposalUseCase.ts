import { UpdateProposalService } from '../services/implementations/UpdateProposalService';

export class UpdateProposalUseCase {
  constructor(private readonly updateProposalService: UpdateProposalService) {}

  async execute(id: string, data: any) {
    const proposal = await this.updateProposalService.execute(id, data);
    return { id: proposal.id };
  }
}
