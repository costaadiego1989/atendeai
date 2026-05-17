import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { FollowUpService } from '../services/FollowUpService';
import { MessageReceivedIntegrationEvent } from '../integration-events/publishers/MessageReceivedIntegrationEvent';

@Injectable()
export class MessagingBusinessRulesHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly followUpService: FollowUpService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event: MessageReceivedIntegrationEvent) => {
        await this.handleMessageReceived(event);
      },
      { consumerName: 'messaging-business-rules-message-received' },
    );
  }

  private async handleMessageReceived(event: MessageReceivedIntegrationEvent) {
    const { conversationId } = event.payload;
    await this.followUpService.cancelFollowUps(conversationId);
  }
}
