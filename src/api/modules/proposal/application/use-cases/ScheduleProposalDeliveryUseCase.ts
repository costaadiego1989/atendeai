import { ScheduleProposalDeliveryService } from '../services/implementations/ScheduleProposalDeliveryService';

export interface ScheduleProposalRequest {
  proposalId: string;
  scheduledAt: Date;
}

export class ScheduleProposalDeliveryUseCase {
  constructor(private readonly scheduleProposalDeliveryService: ScheduleProposalDeliveryService) {}

  async execute(request: ScheduleProposalRequest): Promise<void> {
    await this.scheduleProposalDeliveryService.execute(request.proposalId, request.scheduledAt);
  }
}
