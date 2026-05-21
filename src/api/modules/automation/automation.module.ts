import { Module } from '@nestjs/common';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';

// Use cases
import { CreateAutomationUseCase } from './application/use-cases/CreateAutomationUseCase';
import { UpdateAutomationUseCase } from './application/use-cases/UpdateAutomationUseCase';
import { ListAutomationsUseCase } from './application/use-cases/ListAutomationsUseCase';
import { DeleteAutomationUseCase } from './application/use-cases/DeleteAutomationUseCase';
import { ExecuteAutomationUseCase } from './application/use-cases/ExecuteAutomationUseCase';
import { TriggerAutomationUseCase } from './application/use-cases/TriggerAutomationUseCase';

// Ports
import {
  AUTOMATION_REPOSITORY,
  AUTOMATION_EXECUTION_REPOSITORY,
} from './application/ports/IAutomationRepository';
import { STEP_EXECUTOR } from './application/ports/IStepExecutor';

// Infrastructure
import {
  PrismaAutomationRepository,
  PrismaAutomationExecutionRepository,
} from './infrastructure/persistence/PrismaAutomationRepository';
import { CompositeStepExecutor } from './infrastructure/workers/CompositeStepExecutor';
import { AutomationEventListener } from './infrastructure/workers/AutomationEventListener';

// Presentation
import { AutomationController } from './presentation/controllers/AutomationController';

@Module({
  imports: [DatabaseModule, EventBusModule],
  controllers: [AutomationController],
  providers: [
    // Repositories
    {
      provide: AUTOMATION_REPOSITORY,
      useClass: PrismaAutomationRepository,
    },
    {
      provide: AUTOMATION_EXECUTION_REPOSITORY,
      useClass: PrismaAutomationExecutionRepository,
    },
    // Step executor
    {
      provide: STEP_EXECUTOR,
      useClass: CompositeStepExecutor,
    },
    // Use cases
    CreateAutomationUseCase,
    UpdateAutomationUseCase,
    ListAutomationsUseCase,
    DeleteAutomationUseCase,
    ExecuteAutomationUseCase,
    TriggerAutomationUseCase,
    // Event listener
    AutomationEventListener,
  ],
  exports: [TriggerAutomationUseCase, ExecuteAutomationUseCase],
})
export class AutomationModule {}
