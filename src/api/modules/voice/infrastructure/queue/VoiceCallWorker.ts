import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MakeOutboundCallUseCase } from '../../application/use-cases/MakeOutboundCallUseCase';

export interface VoiceCallJobData {
  tenantId: string;
  contactId: string;
  recoveryCaseId?: string;
  phone: string;
}

@Injectable()
@Processor('voice-calls')
export class VoiceCallWorker extends WorkerHost {
  private readonly logger = new Logger(VoiceCallWorker.name);

  constructor(
    private readonly makeOutboundCallUseCase: MakeOutboundCallUseCase,
  ) {
    super();
  }

  async process(job: Job<VoiceCallJobData>): Promise<any> {
    const { tenantId, contactId, recoveryCaseId, phone } = job.data;

    this.logger.log(`Processing voice call job ${job.id} for tenant ${tenantId}`);

    const result = await this.makeOutboundCallUseCase.execute({
      tenantId,
      contactId,
      recoveryCaseId,
      phone,
    });

    if (!result.success) {
      this.logger.warn(`Voice call job ${job.id} failed: ${result.error}`);
      throw new Error(result.error || 'Call failed');
    }

    return { callId: result.callId, externalCallId: result.externalCallId };
  }
}
