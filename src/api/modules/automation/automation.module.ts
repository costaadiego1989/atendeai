import { forwardRef, Module } from '@nestjs/common';
import { EventBusModule } from '@shared/infrastructure/event-bus/EventBusModule';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { ContactModule } from '@modules/contact/contact.module';
import { AIModule } from '@modules/ai/ai.module';
import { TaskModule } from '@modules/task/task.module';
import { MANUAL_AUTOMATION_FACADE } from '@modules/ai/application/ports/IManualAutomationFacade';
import { ManualAutomationFacade } from './application/services/ManualAutomationFacade';
import { AuthModule } from '@modules/auth/auth.module';

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
import { STEP_HANDLERS } from './application/ports/IStepHandler';

// Infrastructure
import {
  PrismaAutomationRepository,
  PrismaAutomationExecutionRepository,
} from './infrastructure/persistence/PrismaAutomationRepository';
import { CompositeStepExecutor } from './infrastructure/workers/CompositeStepExecutor';
import { AutomationEventListener } from './infrastructure/workers/AutomationEventListener';

// Step handlers
import { SendMessageStepHandler } from './infrastructure/workers/handlers/SendMessageStepHandler';
import { WaitDelayStepHandler } from './infrastructure/workers/handlers/WaitDelayStepHandler';
import { ConditionBranchStepHandler } from './infrastructure/workers/handlers/ConditionBranchStepHandler';
import { HttpRequestStepHandler } from './infrastructure/workers/handlers/HttpRequestStepHandler';
import { UpdateContactStepHandler } from './infrastructure/workers/handlers/UpdateContactStepHandler';
import { AddTagStepHandler } from './infrastructure/workers/handlers/AddTagStepHandler';
import { RemoveTagStepHandler } from './infrastructure/workers/handlers/RemoveTagStepHandler';
import { AssignAgentStepHandler } from './infrastructure/workers/handlers/AssignAgentStepHandler';
import { AiResponseStepHandler } from './infrastructure/workers/handlers/AiResponseStepHandler';
import { CreateTaskStepHandler } from './infrastructure/workers/handlers/CreateTaskStepHandler';

// Presentation
import { AutomationController } from './presentation/controllers/AutomationController';

const STEP_HANDLER_CLASSES = [
  SendMessageStepHandler,
  WaitDelayStepHandler,
  ConditionBranchStepHandler,
  HttpRequestStepHandler,
  UpdateContactStepHandler,
  AddTagStepHandler,
  RemoveTagStepHandler,
  AssignAgentStepHandler,
  AiResponseStepHandler,
  CreateTaskStepHandler,
];

@Module({
  imports: [
    DatabaseModule,
    EventBusModule,
    AuthModule,
    forwardRef(() => MessagingModule),
    ContactModule,
    AIModule,
    TaskModule,
  ],
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
    // Step handlers (strategies)
    ...STEP_HANDLER_CLASSES,
    {
      provide: STEP_HANDLERS,
      useFactory: (...handlers) => handlers,
      inject: STEP_HANDLER_CLASSES,
    },
    // Step executor (dispatcher)
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
    // Manual automation facade — bridges to AIModule
    ManualAutomationFacade,
    {
      provide: MANUAL_AUTOMATION_FACADE,
      useExisting: ManualAutomationFacade,
    },
  ],
  exports: [
    TriggerAutomationUseCase,
    ExecuteAutomationUseCase,
    AUTOMATION_REPOSITORY,
    MANUAL_AUTOMATION_FACADE,
  ],
})
export class AutomationModule {}
