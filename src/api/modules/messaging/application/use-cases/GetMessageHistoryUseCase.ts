import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import {
  IGetMessageHistoryUseCase,
  GetMessageHistoryInput,
  GetMessageHistoryOutput,
} from './interfaces/IGetMessageHistoryUseCase';

@Injectable()
export class GetMessageHistoryUseCase implements IGetMessageHistoryUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(
    input: GetMessageHistoryInput,
  ): Promise<GetMessageHistoryOutput> {
    const page = input.page || 1;
    const limit = input.limit || 50;

    const { data, total } =
      await this.conversationRepository.findMessagesByConversation(
        input.conversationId,
        page,
        limit,
      );

    return {
      data: data.map((m) => ({
        id: m.id.toString(),
        direction: m.direction,
        contentType: m.contentType,
        content: m.content.toPersistence(),
        sentBy: m.sentBy,
        deliveryStatus: m.deliveryStatus,
        timestamp: m.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
