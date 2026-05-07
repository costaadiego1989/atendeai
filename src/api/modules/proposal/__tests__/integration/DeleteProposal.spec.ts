import { DeleteProposalUseCase } from '../../application/use-cases/DeleteProposalUseCase';
import { DeleteProposalService } from '../../application/services/implementations/DeleteProposalService';
import { ProposalNotFoundError } from '../../domain/errors/ProposalNotFoundError';
import { buildProposal, createProposalRepositoryMock } from '../proposal-test-utils';

describe('DeleteProposalUseCase', () => {
  let deleteProposalUseCase: DeleteProposalUseCase;
  let deleteProposalService: DeleteProposalService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    deleteProposalService = new DeleteProposalService(mockRepository);
    deleteProposalUseCase = new DeleteProposalUseCase(deleteProposalService);
  });

  it('deletes a proposal', async () => {
    const existingProposal = buildProposal();
    mockRepository.findById.mockResolvedValue(existingProposal);

    const result = await deleteProposalUseCase.execute(existingProposal.id);

    expect(result).toEqual({ success: true });
    expect(mockRepository.delete).toHaveBeenCalledWith(existingProposal.id);
  });

  it('throws a domain error when the proposal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(deleteProposalUseCase.execute('missing-proposal')).rejects.toBeInstanceOf(
      ProposalNotFoundError,
    );
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
