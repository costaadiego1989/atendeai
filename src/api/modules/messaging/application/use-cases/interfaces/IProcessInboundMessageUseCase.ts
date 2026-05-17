import { IUseCase } from '@shared/application/IUseCase';

export interface ProcessInboundMessageInput {
  tenantId: string;
  branchId?: string | null;
  externalMessageId: string;
  fromPhone: string;
  toPhone: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: {
    text?: string;
    url?: string;
    mimeType?: string;
    fileName?: string;
  };
  channel: 'WHATSAPP' | 'INSTAGRAM';
}

export interface IProcessInboundMessageUseCase extends IUseCase<
  ProcessInboundMessageInput,
  void
> {}
export const IProcessInboundMessageUseCase = Symbol(
  'IProcessInboundMessageUseCase',
);
