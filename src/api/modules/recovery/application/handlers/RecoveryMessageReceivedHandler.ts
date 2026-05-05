import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { RegisterRecoveryReplyUseCase } from '../use-cases/RegisterRecoveryReplyUseCase';

@Injectable()
export class RecoveryMessageReceivedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly registerRecoveryReplyUseCase: RegisterRecoveryReplyUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event) => {
        const payload = event.payload as {
          tenantId: string;
          contactId: string;
          content?: { text?: string };
        };

        await this.registerRecoveryReplyUseCase.execute({
          tenantId: payload.tenantId,
          contactId: payload.contactId,
          messageText: payload.content?.text,
        });
      },
      { consumerName: 'recovery-message-received' },
    );
  }
}
