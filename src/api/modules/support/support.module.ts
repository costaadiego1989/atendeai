import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { ContactModule } from '@modules/contact/contact.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { TenantModule } from '@modules/tenant/tenant.module';
import { SupportFeedbackController } from './presentation/controllers/SupportFeedbackController';
import { CreateSupportFeedbackUseCase } from './application/use-cases/CreateSupportFeedbackUseCase';
import { ListSupportFeedbacksUseCase } from './application/use-cases/ListSupportFeedbacksUseCase';
import { ListAllFeedbacksUseCase } from './application/use-cases/ListAllFeedbacksUseCase';
import { GetFeedbackDetailsUseCase } from './application/use-cases/GetFeedbackDetailsUseCase';
import { UpdateFeedbackStatusUseCase } from './application/use-cases/UpdateFeedbackStatusUseCase';
import { ReplyFeedbackUseCase } from './application/use-cases/ReplyFeedbackUseCase';
import {
  SUPPORT_FEEDBACK_REPOSITORY,
} from './domain/repositories/ISupportFeedbackRepository';
import { PrismaSupportFeedbackRepository } from './infrastructure/persistence/repositories/PrismaSupportFeedbackRepository';

@Module({
  imports: [DatabaseModule, AuthModule, ContactModule, MessagingModule, TenantModule],
  controllers: [SupportFeedbackController],
  providers: [
    CreateSupportFeedbackUseCase,
    ListSupportFeedbacksUseCase,
    ListAllFeedbacksUseCase,
    GetFeedbackDetailsUseCase,
    UpdateFeedbackStatusUseCase,
    ReplyFeedbackUseCase,
    {
      provide: SUPPORT_FEEDBACK_REPOSITORY,
      useClass: PrismaSupportFeedbackRepository,
    },
  ],
  exports: [
    ListAllFeedbacksUseCase,
    GetFeedbackDetailsUseCase,
    UpdateFeedbackStatusUseCase,
    ReplyFeedbackUseCase,
    SUPPORT_FEEDBACK_REPOSITORY,
  ],
})
export class SupportModule {}
