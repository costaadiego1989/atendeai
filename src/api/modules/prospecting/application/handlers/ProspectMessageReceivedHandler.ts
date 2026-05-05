import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/infrastructure/event-bus';
import {
  IRegisterProspectResponseUseCase,
  RegisterProspectResponseInput,
} from '../use-cases/interfaces/IRegisterProspectResponseUseCase';
import {
  IRegisterProspectStopUseCase,
} from '../use-cases/interfaces/IRegisterProspectStopUseCase';
import { ProspectOptOutPolicy } from '../services/ProspectOptOutPolicy';

@Injectable()
export class ProspectMessageReceivedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(IRegisterProspectResponseUseCase)
    private readonly registerProspectResponseUseCase: IRegisterProspectResponseUseCase,
    @Inject(IRegisterProspectStopUseCase)
    private readonly registerProspectStopUseCase: IRegisterProspectStopUseCase,
    private readonly prospectOptOutPolicy: ProspectOptOutPolicy,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event) => {
        const eventPayload = event.payload as {
          tenantId: string;
          contactId: string;
          conversationId: string;
          messageId: string;
          content?: { text?: string };
        };
        const payload: RegisterProspectResponseInput = {
          tenantId: eventPayload.tenantId,
          contactId: eventPayload.contactId,
          conversationId: eventPayload.conversationId,
          messageId: eventPayload.messageId,
          messageText: eventPayload.content?.text,
        };

        if (this.prospectOptOutPolicy.shouldStop(payload.messageText)) {
          await this.registerProspectStopUseCase.execute(payload);
          return;
        }

        await this.registerProspectResponseUseCase.execute(payload);
      },
      { consumerName: 'prospecting-message-received' },
    );
  }
}
