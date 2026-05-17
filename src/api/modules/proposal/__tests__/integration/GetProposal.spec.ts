import { GetProposalUseCase } from '../../application/use-cases/GetProposalUseCase';
import { GetProposalService } from '../../application/services/implementations/GetProposalService';
import { ProposalNotFoundError } from '../../domain/errors/ProposalNotFoundError';
import {
  buildProposal,
  createProposalRepositoryMock,
} from '../proposal-test-utils';

describe('GetProposalUseCase', () => {
  let getProposalUseCase: GetProposalUseCase;
  let getProposalService: GetProposalService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    getProposalService = new GetProposalService(mockRepository);
    getProposalUseCase = new GetProposalUseCase(getProposalService);
  });

  it('returns a proposal as JSON', async () => {
    const existingProposal = buildProposal();
    mockRepository.findById.mockResolvedValue(existingProposal);

    const result = await getProposalUseCase.execute(existingProposal.id);

    expect(result).toEqual(
      expect.objectContaining({
        id: existingProposal.id,
        title: existingProposal.title,
        totalAmount: existingProposal.totalAmount,
      }),
    );
  });

  it('throws a domain error when the proposal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      getProposalUseCase.execute('missing-proposal'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});
