import { ListProposalsUseCase } from '../../application/use-cases/ListProposalsUseCase';
import { ListProposalsService } from '../../application/services/implementations/ListProposalsService';
import { buildProposal, createProposalRepositoryMock } from '../proposal-test-utils';

describe('ListProposalsUseCase', () => {
  let listProposalsUseCase: ListProposalsUseCase;
  let listProposalsService: ListProposalsService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    listProposalsService = new ListProposalsService(mockRepository);
    listProposalsUseCase = new ListProposalsUseCase(listProposalsService);
  });

  it('returns all proposals for a tenant', async () => {
    const proposalA = buildProposal({ id: 'proposal-a', tenantId: 'tenant-1' });
    const proposalB = buildProposal({ id: 'proposal-b', tenantId: 'tenant-1' });
    mockRepository.findByTenantId.mockResolvedValue([proposalA, proposalB]);

    const result = await listProposalsUseCase.execute('tenant-1');

    expect(mockRepository.findByTenantId).toHaveBeenCalledWith('tenant-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'proposal-a' }));
    expect(result[1]).toEqual(expect.objectContaining({ id: 'proposal-b' }));
  });
});
