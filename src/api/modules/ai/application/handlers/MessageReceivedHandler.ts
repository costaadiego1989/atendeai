import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import {
  IProcessAIResponseUseCase,
  ProcessAIResponseInput,
} from '../use-cases/interfaces/IProcessAIResponseUseCase';

@Injectable()
export class MessageReceivedHandler implements OnModuleInit {
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
        const payload = event.payload as unknown as ProcessAIResponseInput;
        await this.handle(payload);
      },
      { consumerName: 'ai-message-received' },
    );
  }

  private async handle(payload: ProcessAIResponseInput) {
    await this.processAIResponseUseCase.execute(payload);
  }
}
