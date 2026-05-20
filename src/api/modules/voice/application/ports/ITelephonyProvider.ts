export interface MakeCallParams {
  to: string;
  from: string;
  webhookUrl: string;
  statusCallbackUrl: string;
}

export interface MakeCallResult {
  success: boolean;
  externalCallId?: string;
  error?: string;
}

export interface ITelephonyProvider {
  makeCall(params: MakeCallParams): Promise<MakeCallResult>;
  endCall(externalCallId: string): Promise<void>;
  transferCall(externalCallId: string, to: string): Promise<void>;
}

export const TELEPHONY_PROVIDER = Symbol('ITelephonyProvider');
