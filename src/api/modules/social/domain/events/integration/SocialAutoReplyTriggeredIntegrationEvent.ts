import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class SocialAutoReplyTriggeredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'social.automation';
  readonly sourceModule = 'social';

  constructor(
    readonly payload: {
      tenantId: string;
      commentId: string;
      ruleId: string;
      platform: string;
      action: 'COMMENT_REPLY' | 'INBOX_DM' | 'DM_CONVERSATION';
    },
  ) {
    super();
  }
}

