import { ScheduleProposalDeliveryUseCase } from '../../application/use-cases/ScheduleProposalDeliveryUseCase';
import { ScheduleProposalDeliveryService } from '../../application/services/implementations/ScheduleProposalDeliveryService';
import { ProposalInvalidScheduleDateError } from '../../domain/errors/ProposalInvalidScheduleDateError';
import { ProposalNotFoundError } from '../../domain/errors/ProposalNotFoundError';
import { ProposalEmptyItemsError } from '../../domain/errors/ProposalEmptyItemsError';
import {
  buildProposal,
  createProposalRepositoryMock,
  createQueueMock,
} from '../proposal-test-utils';

describe('ScheduleProposalDeliveryUseCase', () => {
  let scheduleProposalDeliveryUseCase: ScheduleProposalDeliveryUseCase;
  let scheduleProposalDeliveryService: ScheduleProposalDeliveryService;
  let mockRepository: ReturnType<typeof createProposalRepositoryMock>;
  let mockQueue: ReturnType<typeof createQueueMock>;

  beforeEach(() => {
    mockRepository = createProposalRepositoryMock();
    mockQueue = createQueueMock();
    scheduleProposalDeliveryService = new ScheduleProposalDeliveryService(
      mockRepository,
      mockQueue as any,
    );
    scheduleProposalDeliveryUseCase = new ScheduleProposalDeliveryUseCase(
      scheduleProposalDeliveryService,
    );
  });

  it('schedules the proposal delivery and enqueues a job', async () => {
    const proposal = buildProposal();
    mockRepository.findById.mockResolvedValue(proposal);
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

    await scheduleProposalDeliveryUseCase.execute({
      proposalId: proposal.id,
      scheduledAt,
    });

    expect(mockRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SCHEDULED',
        scheduledAt,
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-proposal',
      { proposalId: proposal.id },
      expect.objectContaining({
        jobId: `send-proposal-${proposal.id}`,
      }),
    );
  });

  it('throws a domain error when the proposal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      scheduleProposalDeliveryUseCase.execute({
        proposalId: 'missing-proposal',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ).rejects.toBeInstanceOf(ProposalNotFoundError);
  });

  it('throws a domain error when the schedule date is in the past', async () => {
    const proposal = buildProposal();
    mockRepository.findById.mockResolvedValue(proposal);

    await expect(
      scheduleProposalDeliveryUseCase.execute({
        proposalId: proposal.id,
        scheduledAt: new Date(Date.now() - 60 * 1000),
      }),
    ).rejects.toBeInstanceOf(ProposalInvalidScheduleDateError);
  });

  it('throws a domain error when trying to schedule an empty proposal', async () => {
    const emptyProposal = buildProposal({ items: [] });
    mockRepository.findById.mockResolvedValue(emptyProposal);

    await expect(
      scheduleProposalDeliveryUseCase.execute({
        proposalId: emptyProposal.id,
        scheduledAt: new Date(Date.now() + 60 * 1000),
      }),
    ).rejects.toBeInstanceOf(ProposalEmptyItemsError);
  });
});
