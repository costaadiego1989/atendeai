import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IVoiceCallRepository,
  VOICE_CALL_REPOSITORY,
} from '../ports/IVoiceCallRepository';
import {
  VoiceCallStatus,
  VoiceCallOutcome,
} from '../../domain/entities/VoiceCall';

export interface ProcessCallOutcomeCommand {
  callId: string;
  /** Twilio CallStatus string e.g. "completed", "busy", "no-answer", "failed" */
  twilioStatus: string;
  duration: number;
  recordingUrl?: string | null;
}

export interface ProcessCallOutcomeResult {
  /** true if record was updated, false if call was not found or already completed (idempotent) */
  updated: boolean;
}

const STATUS_MAP: Record<string, VoiceCallStatus> = {
  queued: 'QUEUED',
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  failed: 'FAILED',
  'no-answer': 'NO_ANSWER',
  busy: 'BUSY',
};

/**
 * Maps a terminal VoiceCallStatus to a default VoiceCallOutcome when no outcome
 * was already set by the gather flow.
 */
const TERMINAL_OUTCOME_MAP: Partial<Record<VoiceCallStatus, VoiceCallOutcome>> =
  {
    NO_ANSWER: 'NO_ANSWER',
    BUSY: 'NO_ANSWER', // BUSY is functionally "not answered"
    FAILED: 'ERROR',
  };

const TERMINAL_STATUSES: VoiceCallStatus[] = [
  'COMPLETED',
  'FAILED',
  'NO_ANSWER',
  'BUSY',
];

@Injectable()
export class ProcessCallOutcomeUseCase {
  private readonly logger = new Logger(ProcessCallOutcomeUseCase.name);

  constructor(
    @Inject(VOICE_CALL_REPOSITORY)
    private readonly voiceCallRepo: IVoiceCallRepository,
  ) {}

  async execute(
    command: ProcessCallOutcomeCommand,
  ): Promise<ProcessCallOutcomeResult> {
    const { callId, twilioStatus, duration, recordingUrl } = command;
    const mappedStatus: VoiceCallStatus =
      STATUS_MAP[twilioStatus] ?? 'COMPLETED';

    this.logger.log(
      `Call ${callId} outcome: twilioStatus=${twilioStatus} → ${mappedStatus}`,
    );

    // We need tenantId to scope the repo call.  The repo's findById requires tenantId,
    // so we use the PrismaService-backed findById workaround: tenantId is unknown here,
    // so the repository exposes a findByIdUnscoped path through the interface.
    // Instead, ProcessCallOutcomeUseCase receives tenantId from the controller that
    // already did the unscoped lookup. See controller for context.
    // (This use case is called only after the controller fetches the call to get tenantId.)
    throw new Error(
      'ProcessCallOutcomeUseCase.execute() must receive tenantId — use executeScoped()',
    );
  }

  /**
   * Scoped entry point — called by the controller after it resolves tenantId.
   */
  async executeScoped(
    callId: string,
    tenantId: string,
    twilioStatus: string,
    duration: number,
    recordingUrl?: string | null,
  ): Promise<ProcessCallOutcomeResult> {
    const mappedStatus: VoiceCallStatus =
      STATUS_MAP[twilioStatus] ?? 'COMPLETED';

    this.logger.log(
      `Call ${callId} (tenant ${tenantId}) outcome: ${twilioStatus} → ${mappedStatus}`,
    );

    // Fetch current call to check existing outcome (prevent override) and idempotency
    const call = await this.voiceCallRepo.findById(callId, tenantId);

    if (!call) {
      this.logger.warn(`Call ${callId} not found for tenant ${tenantId}`);
      return { updated: false };
    }

    // Idempotent: if call is already in a terminal status and the incoming status
    // is COMPLETED again, treat it as a no-op
    if (
      TERMINAL_STATUSES.includes(call.status) &&
      mappedStatus === 'COMPLETED'
    ) {
      this.logger.log(
        `Call ${callId} already in terminal status ${call.status} — skipping duplicate COMPLETED webhook`,
      );
      return { updated: false };
    }

    const extra: Partial<
      Pick<typeof call, 'duration' | 'recordingUrl' | 'outcome'>
    > = {};
    if (duration) extra.duration = duration;
    if (recordingUrl) extra.recordingUrl = recordingUrl;

    // Only set outcome when none already exists from the gather flow
    if (!call.outcome && TERMINAL_STATUSES.includes(mappedStatus)) {
      const defaultOutcome = TERMINAL_OUTCOME_MAP[mappedStatus];
      if (defaultOutcome) extra.outcome = defaultOutcome;
    }

    await this.voiceCallRepo.updateStatus(
      callId,
      tenantId,
      mappedStatus,
      extra,
    );
    return { updated: true };
  }
}
