import { GenerateProposalPdfUseCase } from '../../application/use-cases/GenerateProposalPdfUseCase';
import { ProposalNotFoundError } from '../../domain/errors/ProposalNotFoundError';
import {
  buildProposal,
  createFileStorageMock,
  createProposalRepositoryMock,
} from '../proposal-test-utils';

describe('GenerateProposalPdfUseCase', () => {
  let generateProposalPdfUseCase: GenerateProposalPdfUseCase;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;
  let mockStorage: ReturnType<typeof createFileStorageMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    mockStorage = createFileStorageMock();
    generateProposalPdfUseCase = new GenerateProposalPdfUseCase(
      mockRepository,
      mockStorage,
    );
  });

  it('generates a PDF and stores the URL on the proposal', async () => {
    const proposal = buildProposal({ pdfUrl: null });
    mockRepository.findById.mockResolvedValue(proposal);
    mockStorage.upload.mockResolvedValue('https://cdn.test/proposals/proposal-1.pdf');

    const pdfUrl = await generateProposalPdfUseCase.execute(proposal.id);

    expect(pdfUrl).toBe('https://cdn.test/proposals/proposal-1.pdf');
    expect(mockStorage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      `proposal-${proposal.id}.pdf`,
      'application/pdf',
      { folder: 'proposals' },
    );
    expect(mockRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfUrl: 'https://cdn.test/proposals/proposal-1.pdf',
      }),
    );
  });

  it('throws a domain error when the proposal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      generateProposalPdfUseCase.execute('missing-proposal'),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});
