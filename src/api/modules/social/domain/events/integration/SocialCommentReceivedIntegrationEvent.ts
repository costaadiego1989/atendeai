import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class SocialCommentReceivedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'social.automation';
  readonly sourceModule = 'social';

  constructor(
    readonly payload: {
      tenantId: string;
      commentId: string;
      externalCommentId: string;
      platform: string;
      authorExternalId?: string | null;
    },
  ) {
    super();
  }
}

