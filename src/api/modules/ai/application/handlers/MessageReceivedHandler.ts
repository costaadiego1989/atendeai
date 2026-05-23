import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import {
  IProcessAIResponseUseCase,
  ProcessAIResponseInput,
} from '../use-cases/interfaces/IProcessAIResponseUseCase';

@Injectable()
export class MessageReceivedHandler implements OnModuleInit {
  private readonly logger = new Logger(MessageReceivedHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(IProcessAIResponseUseCase)
    private readonly processAIResponseUseCase: IProcessAIResponseUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event) => {
        await this.handle(event.payload);
      },
      { consumerName: 'ai-message-received' },
    );
  }

  private async handle(rawPayload: Record<string, unknown>) {
    if (!this.isValidPayload(rawPayload)) {
      this.logger.warn(
        `message_received_invalid_payload conversation=${String(
          rawPayload?.conversationId,
        )}`,
      );
      return;
    }

    await this.processAIResponseUseCase.execute(rawPayload);
  }

  private isValidPayload(
    payload: Record<string, unknown>,
  ): payload is ProcessAIResponseInput & Record<string, unknown> {
    const content = payload?.content as { type?: unknown } | undefined;
    return (
      typeof payload?.tenantId === 'string' &&
      payload.tenantId.length > 0 &&
      typeof payload.contactId === 'string' &&
      payload.contactId.length > 0 &&
      typeof payload.conversationId === 'string' &&
      payload.conversationId.length > 0 &&
      typeof content === 'object' &&
      content !== null
    );
  }
}
