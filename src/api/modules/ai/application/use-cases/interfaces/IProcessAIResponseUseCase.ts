import { IUseCase } from '@shared/application/IUseCase';

export interface ProcessAIResponseInput {
  conversationId: string;
  tenantId: string;
  contactId: string;
  branchId?: string | null;
  content: {
    type: string;
    text?: string;
    url?: string;
    mimeType?: string;
    fileName?: string;
  };
  moduleId?: string;
  contextHints?: string[];
}

export interface ProcessAIResponseOutput {
  success: boolean;
  error?: string;
  message?: string;
}

export interface IProcessAIResponseUseCase extends IUseCase<
  ProcessAIResponseInput,
  ProcessAIResponseOutput
> {}
export const IProcessAIResponseUseCase = Symbol('IProcessAIResponseUseCase');
