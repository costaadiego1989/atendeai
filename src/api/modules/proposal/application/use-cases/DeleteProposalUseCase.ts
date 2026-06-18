import { DeleteProposalService } from '../services/implementations/DeleteProposalService';

export class DeleteProposalUseCase {
  constructor(private readonly deleteProposalService: DeleteProposalService) {}

  async execute(id: string, tenantId: string) {
    await this.deleteProposalService.execute(id, tenantId);
    return { success: true };
  }
}
