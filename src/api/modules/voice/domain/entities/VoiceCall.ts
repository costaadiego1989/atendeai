export type VoiceCallDirection = 'INBOUND' | 'OUTBOUND';
export type VoiceCallStatus =
  | 'QUEUED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER'
  | 'BUSY';
export type VoiceCallOutcome =
  | 'PAID'
  | 'NEGOTIATED'
  | 'REFUSED'
  | 'NO_ANSWER'
  | 'VOICEMAIL'
  | 'TRANSFERRED'
  | 'ERROR';

export interface NegotiationResult {
  offeredDiscount: number;
  offeredInstallments: number;
  accepted: boolean;
  paymentLinkSent: boolean;
}

export interface VoiceCall {
  id: string;
  tenantId: string;
  contactId: string;
  recoveryCaseId?: string | null;
  direction: VoiceCallDirection;
  status: VoiceCallStatus;
  duration?: number | null;
  recordingUrl?: string | null;
  transcript?: Record<string, unknown>[] | null;
  sentiment?: string | null;
  outcome?: VoiceCallOutcome | null;
  negotiation?: NegotiationResult | null;
  externalCallId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
