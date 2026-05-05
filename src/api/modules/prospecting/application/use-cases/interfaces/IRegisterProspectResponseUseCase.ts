import { IUseCase } from '@shared/application/IUseCase';

export interface RegisterProspectResponseInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  messageText?: string;
}

export interface RegisterProspectResponseOutput {
  executionId: string;
  status: 'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED';
}

export interface IRegisterProspectResponseUseCase
  extends IUseCase<
    RegisterProspectResponseInput,
    RegisterProspectResponseOutput | null
  > {}

export const IRegisterProspectResponseUseCase = Symbol(
  'IRegisterProspectResponseUseCase',
);
