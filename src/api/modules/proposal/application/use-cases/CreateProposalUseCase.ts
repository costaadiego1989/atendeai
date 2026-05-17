import {
  CreateProposalService,
  CreateProposalData,
} from '../services/implementations/CreateProposalService';

export class CreateProposalUseCase {
  constructor(private readonly createProposalService: CreateProposalService) {}

  async execute(request: CreateProposalData): Promise<{ id: string }> {
    const proposal = await this.createProposalService.execute(request);
    return { id: proposal.id };
  }
}
