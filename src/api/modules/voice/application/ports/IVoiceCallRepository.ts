import {
  VoiceCall,
  VoiceCallStatus,
  VoiceCallOutcome,
} from '../../domain/entities/VoiceCall';

export interface TranscriptEntry {
  role: 'agent' | 'customer';
  text: string;
  confidence?: number;
  timestamp: string;
}

export interface IVoiceCallRepository {
  findById(id: string, tenantId: string): Promise<VoiceCall | null>;
  save(
    call: Omit<VoiceCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<VoiceCall>;
  updateStatus(
    callId: string,
    tenantId: string,
    status: VoiceCallStatus,
    extra?: Partial<
      Pick<
        VoiceCall,
        'duration' | 'recordingUrl' | 'outcome' | 'externalCallId'
      >
    >,
  ): Promise<void>;
  appendTranscript(
    callId: string,
    tenantId: string,
    entry: TranscriptEntry,
  ): Promise<void>;
}

export const VOICE_CALL_REPOSITORY = 'VOICE_CALL_REPOSITORY';
