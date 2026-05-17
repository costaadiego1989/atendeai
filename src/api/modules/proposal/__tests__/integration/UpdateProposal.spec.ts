import { UpdateProposalUseCase } from '../../application/use-cases/UpdateProposalUseCase';
import { UpdateProposalService } from '../../application/services/implementations/UpdateProposalService';
import { ProposalNotFoundError } from '../../domain/errors/ProposalNotFoundError';
import {
  buildProposal,
  createProposalRepositoryMock,
} from '../proposal-test-utils';

describe('UpdateProposalUseCase', () => {
  let updateProposalUseCase: UpdateProposalUseCase;
  let updateProposalService: UpdateProposalService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    updateProposalService = new UpdateProposalService(mockRepository);
    updateProposalUseCase = new UpdateProposalUseCase(updateProposalService);
  });

  it('updates a proposal and persists the changes', async () => {
    const existingProposal = buildProposal();
    mockRepository.findById.mockResolvedValue(existingProposal);

    const result = await updateProposalUseCase.execute(existingProposal.id, {
      title: 'Updated Proposal',
      items: [
        { name: 'Diagnóstico inicial', quantity: 2, unitPrice: 1000 },
        { name: 'Execução assistida', quantity: 1, unitPrice: 2500 },
      ],
      benefits: 'Novo benefício',
    });

    expect(result.id).toBe(existingProposal.id);
    expect(mockRepository.update).toHaveBeenCalledTimes(1);

    const updated = mockRepository.update.mock.calls[0][0];
    expect(updated.title).toBe('Updated Proposal');
    expect(updated.benefits).toBe('Novo benefício');
    expect(updated.totalAmount).toBe(4500);
  });

  it('throws a domain error when the proposal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      updateProposalUseCase.execute('missing-proposal', {
        title: 'Updated Proposal',
      }),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);

    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});
