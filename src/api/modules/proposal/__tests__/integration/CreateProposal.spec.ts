import { CreateProposalUseCase } from '../../application/use-cases/CreateProposalUseCase';
import { CreateProposalService } from '../../application/services/implementations/CreateProposalService';
import { ProposalTitleTooShortError } from '../../domain/errors/ProposalTitleTooShortError';
import { ProposalItemNameRequiredError } from '../../domain/errors/ProposalItemNameRequiredError';
import {
  createProposalRepositoryMock,
  buildCreateProposalData,
} from '../proposal-test-utils';

describe('CreateProposalUseCase', () => {
  let createProposalUseCase: CreateProposalUseCase;
  let createProposalService: CreateProposalService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    createProposalService = new CreateProposalService(mockRepository);
    createProposalUseCase = new CreateProposalUseCase(createProposalService);
  });

  it('creates a proposal and persists it', async () => {
    const request = buildCreateProposalData();

    const result = await createProposalUseCase.execute(request);

    expect(result.id).toBeDefined();
    expect(mockRepository.save).toHaveBeenCalledTimes(1);

    const savedProposal = mockRepository.save.mock.calls[0][0];
    expect(savedProposal.tenantId).toBe(request.tenantId);
    expect(savedProposal.contactId).toBe(request.contactId);
    expect(savedProposal.userId).toBe(request.userId);
    expect(savedProposal.title).toBe(request.title);
    expect(savedProposal.totalAmount).toBe(3500);
  });

  it('throws a domain error when the title is too short', async () => {
    const request = buildCreateProposalData({ title: 'Ab' });

    await expect(createProposalUseCase.execute(request)).rejects.toBeInstanceOf(
      ProposalTitleTooShortError,
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('throws a domain error when an item has no name', async () => {
    const request = buildCreateProposalData({
      items: [{ name: '', quantity: 1, unitPrice: 50 }],
    });

    await expect(createProposalUseCase.execute(request)).rejects.toBeInstanceOf(
      ProposalItemNameRequiredError,
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
