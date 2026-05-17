import { IUseCase } from '@shared/application/IUseCase';

export interface RegisterProspectStopInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  messageText?: string;
}

export interface RegisterProspectStopOutput {
  executionId: string;
  status: 'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED';
  stopReason:
    | 'OPT_OUT'
    | 'HUMAN_HANDOFF'
    | 'DISQUALIFIED'
    | 'CAMPAIGN_PAUSED'
    | 'ALREADY_CONTACTED'
    | 'COOLDOWN_ACTIVE'
    | 'NO_WHATSAPP_PHONE'
    | 'TEMPLATE_UNAVAILABLE';
}

export interface IRegisterProspectStopUseCase extends IUseCase<
  RegisterProspectStopInput,
  RegisterProspectStopOutput | null
> {}

export const IRegisterProspectStopUseCase = Symbol(
  'IRegisterProspectStopUseCase',
);
