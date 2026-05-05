import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { SupportFeedbackController } from './presentation/controllers/SupportFeedbackController';
import { CreateSupportFeedbackUseCase } from './application/use-cases/CreateSupportFeedbackUseCase';
import { ListSupportFeedbacksUseCase } from './application/use-cases/ListSupportFeedbacksUseCase';
import {
  SUPPORT_FEEDBACK_REPOSITORY,
} from './domain/repositories/ISupportFeedbackRepository';
import { PrismaSupportFeedbackRepository } from './infrastructure/persistence/repositories/PrismaSupportFeedbackRepository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SupportFeedbackController],
  providers: [
    CreateSupportFeedbackUseCase,
    ListSupportFeedbacksUseCase,
    {
      provide: SUPPORT_FEEDBACK_REPOSITORY,
      useClass: PrismaSupportFeedbackRepository,
    },
  ],
})
export class SupportModule {}
