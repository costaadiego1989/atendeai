import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class SocialManualReplySentIntegrationEvent extends IntegrationEvent {
  readonly queue = 'social.automation';
  readonly sourceModule = 'social';

  constructor(
    readonly payload: {
      tenantId: string;
      commentId: string;
      replyId: string;
      userId?: string;
      platform: string;
    },
  ) {
    super();
  }
}

