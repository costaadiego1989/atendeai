import { DeleteProposalService } from '../services/implementations/DeleteProposalService';

export class DeleteProposalUseCase {
  constructor(private readonly deleteProposalService: DeleteProposalService) {}

  async execute(id: string) {
    await this.deleteProposalService.execute(id);
    return { success: true };
  }
}
