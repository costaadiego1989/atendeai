import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ISocialAccountFacade,
  ConnectSocialAccountInput,
} from '../../application/ports/ISocialAccountFacade';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import { SocialAccount } from '../../domain/entities/SocialAccount';
import { MetaTokenExchangeService } from './MetaTokenExchangeService';

@Injectable()
export class SocialAccountFacade implements ISocialAccountFacade {
  private readonly logger = new Logger(SocialAccountFacade.name);

  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    private readonly tokenExchangeService: MetaTokenExchangeService,
  ) {}

  async connectAccount(
    input: ConnectSocialAccountInput,
  ): Promise<{ id: string }> {
    let accessToken = input.accessToken;
    let tokenExpiresAt: Date | null = null;

    try {
      const longLived =
        await this.tokenExchangeService.exchangeForLongLivedToken(
          input.accessToken,
        );
      accessToken = longLived.accessToken;
      tokenExpiresAt = new Date(Date.now() + longLived.expiresInSeconds * 1000);
    } catch (err: any) {
      this.logger.warn(
        `Long-lived token exchange failed for tenant ${input.tenantId}: ${err.message}. Using provided token.`,
      );
    }

    const account = SocialAccount.create({
      tenantId: input.tenantId,
      platform: input.platform,
      externalAccountId: input.externalAccountId,
      username: input.username || null,
      displayName: input.displayName || null,
      profilePictureUrl: input.profilePictureUrl || null,
      accessToken,
      refreshToken: null,
      tokenExpiresAt,
      pageId: input.pageId,
      webhookSecret: null,
    });

    await this.repo.saveAccount(account);
    await this.repo.logAudit(input.tenantId, {
      event: 'ACCOUNT_CONNECTED',
      entityId: account.id.toValue(),
      entityType: 'ACCOUNT',
      platform: input.platform,
      metadata: { username: input.username, source: 'facade' },
    });

    return { id: account.id.toValue() };
  }
}
