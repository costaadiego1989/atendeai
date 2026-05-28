import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { SocialController } from './presentation/controllers/SocialController';
import { SocialOAuthController } from './presentation/controllers/SocialOAuthController';
import { SocialWebhookController } from './presentation/controllers/SocialWebhookController';
import { SOCIAL_REPOSITORY } from './domain/ports/ISocialRepository';
import { SOCIAL_PLATFORM_ADAPTER } from './domain/ports/ISocialPlatformAdapter';
import { SOCIAL_DELAYED_JOB_QUEUE } from './domain/ports/ISocialDelayedJobQueue';
import { SOCIAL_ACCOUNT_FACADE } from './application/ports/ISocialAccountFacade';
import { PrismaSocialRepository } from './infrastructure/persistence/PrismaSocialRepository';
import { InstagramGraphCommentAdapter } from './infrastructure/adapters/InstagramGraphCommentAdapter';
import { LinkedInAdapter } from './infrastructure/adapters/LinkedInAdapter';
import { BullMQSocialDelayedJobQueue } from './infrastructure/queue/BullMQSocialDelayedJobQueue';
import { SocialDelayedJobProcessor } from './infrastructure/queue/SocialDelayedJobProcessor';
import { MetaTokenExchangeService } from './infrastructure/services/MetaTokenExchangeService';
import { SocialOAuthService } from './infrastructure/services/SocialOAuthService';
import { TokenRefreshScheduler } from './infrastructure/services/TokenRefreshScheduler';
import { SocialAccountFacade } from './infrastructure/services/SocialAccountFacade';
import { AutoReplyEngine } from './application/services/AutoReplyEngine';
import { ProcessIncomingCommentUseCase } from './application/use-cases/ProcessIncomingCommentUseCase';
import { ReplyToCommentUseCase } from './application/use-cases/ReplyToCommentUseCase';
import { ListSocialCommentsUseCase } from './application/use-cases/ListSocialCommentsUseCase';
import { ConfigureAutoReplyRulesUseCase } from './application/use-cases/ConfigureAutoReplyRulesUseCase';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: 'social-delayed' })],
  controllers: [
    SocialController,
    SocialOAuthController,
    SocialWebhookController,
  ],
  providers: [
    {
      provide: SOCIAL_REPOSITORY,
      useClass: PrismaSocialRepository,
    },
    InstagramGraphCommentAdapter,
    LinkedInAdapter,
    {
      provide: SOCIAL_PLATFORM_ADAPTER,
      useExisting: InstagramGraphCommentAdapter,
    },
    {
      provide: SOCIAL_DELAYED_JOB_QUEUE,
      useClass: BullMQSocialDelayedJobQueue,
    },
    SocialDelayedJobProcessor,
    MetaTokenExchangeService,
    SocialOAuthService,
    TokenRefreshScheduler,
    SocialAccountFacade,
    {
      provide: SOCIAL_ACCOUNT_FACADE,
      useExisting: SocialAccountFacade,
    },
    AutoReplyEngine,
    ProcessIncomingCommentUseCase,
    ReplyToCommentUseCase,
    ListSocialCommentsUseCase,
    ConfigureAutoReplyRulesUseCase,
  ],
  exports: [
    SOCIAL_REPOSITORY,
    SOCIAL_PLATFORM_ADAPTER,
    SOCIAL_ACCOUNT_FACADE,
    ProcessIncomingCommentUseCase,
    AutoReplyEngine,
  ],
})
export class SocialModule {}
