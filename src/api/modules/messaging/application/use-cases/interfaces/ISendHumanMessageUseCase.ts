import { IUseCase } from '@shared/application/IUseCase';

export interface SendHumanMessageInput {
  tenantId: string;
  conversationId: string;
  actorUserId?: string;
  content: {
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    url?: string;
  };
}

export interface SendHumanMessageOutput {
  id: string;
  status: 'QUEUED';
}

export interface ISendHumanMessageUseCase extends IUseCase<
  SendHumanMessageInput,
  SendHumanMessageOutput
> {}
export const ISendHumanMessageUseCase = Symbol('ISendHumanMessageUseCase');
