import { IUseCase } from '@shared/application/IUseCase';

export interface DispatchProspectExecutionInput {
  tenantId: string;
  executionId: string;
}

export interface DispatchProspectExecutionOutput {
  executionId: string;
  conversationId: string;
  messageId: string;
  status: 'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED';
  renderedMessage: string;
}

export interface IDispatchProspectExecutionUseCase
  extends IUseCase<
    DispatchProspectExecutionInput,
    DispatchProspectExecutionOutput
  > {}

export const IDispatchProspectExecutionUseCase = Symbol(
  'IDispatchProspectExecutionUseCase',
);
