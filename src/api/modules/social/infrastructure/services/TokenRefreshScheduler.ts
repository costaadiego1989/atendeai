import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import { MetaTokenExchangeService } from './MetaTokenExchangeService';

@Injectable()
export class TokenRefreshScheduler {
  private readonly logger = new Logger(TokenRefreshScheduler.name);

  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    private readonly tokenExchangeService: MetaTokenExchangeService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTokenRefresh(): Promise<void> {
    this.logger.log('Starting scheduled token refresh check');

    const expiringAccounts = await this.repo.listAccountsWithExpiringTokens(10);

    if (!expiringAccounts.length) {
      this.logger.log('No accounts with expiring tokens found');
      return;
    }

    this.logger.log(
      `Found ${expiringAccounts.length} accounts with tokens expiring within 10 days`,
    );

    for (const account of expiringAccounts) {
      try {
        const result = await this.tokenExchangeService.refreshLongLivedToken(
          account.accessToken,
        );

        const newExpiresAt = new Date(
          Date.now() + result.expiresInSeconds * 1000,
        );

        await this.repo.updateAccountToken(
          account.tenantId,
          account.id.toValue(),
          result.accessToken,
          newExpiresAt,
        );

        this.logger.log(
          `Token refreshed for account ${account.id.toValue()} (tenant: ${account.tenantId})`,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to refresh token for account ${account.id.toValue()} (tenant: ${account.tenantId}): ${err.message}`,
        );
      }
    }

    this.logger.log('Token refresh check completed');
  }
}
