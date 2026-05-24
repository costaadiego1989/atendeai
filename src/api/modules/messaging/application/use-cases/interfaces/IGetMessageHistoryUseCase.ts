import { IUseCase } from '@shared/application/IUseCase';
import { MessageContentProps } from '../../../domain/value-objects/MessageContent';

export interface GetMessageHistoryInput {
  tenantId: string;
  conversationId: string;
  page?: number;
  limit?: number;
}

export interface GetMessageHistoryOutput {
  data: {
    id: string;
    direction: string;
    contentType: string;
    content: MessageContentProps;
    sentBy: string;
    deliveryStatus: string;
    timestamp: Date;
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IGetMessageHistoryUseCase extends IUseCase<
  GetMessageHistoryInput,
  GetMessageHistoryOutput
> {}
export const IGetMessageHistoryUseCase = Symbol('IGetMessageHistoryUseCase');
