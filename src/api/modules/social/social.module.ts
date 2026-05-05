import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { SocialController } from './presentation/controllers/SocialController';
import { SocialWebhookController } from './presentation/controllers/SocialWebhookController';
import { SOCIAL_REPOSITORY } from './domain/ports/ISocialRepository';
import { SOCIAL_PLATFORM_ADAPTER } from './domain/ports/ISocialPlatformAdapter';
import { PrismaSocialRepository } from './infrastructure/persistence/PrismaSocialRepository';
import { InstagramGraphCommentAdapter } from './infrastructure/adapters/InstagramGraphCommentAdapter';
import { LinkedInAdapter } from './infrastructure/adapters/LinkedInAdapter';
import { AutoReplyEngine } from './application/services/AutoReplyEngine';
import { ProcessIncomingCommentUseCase } from './application/use-cases/ProcessIncomingCommentUseCase';
import { ReplyToCommentUseCase } from './application/use-cases/ReplyToCommentUseCase';
import { ListSocialCommentsUseCase } from './application/use-cases/ListSocialCommentsUseCase';
import { ConfigureAutoReplyRulesUseCase } from './application/use-cases/ConfigureAutoReplyRulesUseCase';

@Module({
  imports: [AuthModule],
  controllers: [SocialController, SocialWebhookController],
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
    AutoReplyEngine,
    ProcessIncomingCommentUseCase,
    ReplyToCommentUseCase,
    ListSocialCommentsUseCase,
    ConfigureAutoReplyRulesUseCase,
  ],
  exports: [
    SOCIAL_REPOSITORY,
    SOCIAL_PLATFORM_ADAPTER,
    ProcessIncomingCommentUseCase,
    AutoReplyEngine,
  ],
})
export class SocialModule { }
