import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { TASK_REPOSITORY } from './application/ports/ITaskRepository';
import { PrismaTaskRepository } from './infrastructure/persistence/PrismaTaskRepository';
import { CreateTaskUseCase } from './application/use-cases/CreateTaskUseCase';
import { TASK_FACADE, TaskFacade } from './application/facades/TaskFacade';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: TASK_REPOSITORY,
      useClass: PrismaTaskRepository,
    },
    CreateTaskUseCase,
    {
      provide: TASK_FACADE,
      useClass: TaskFacade,
    },
  ],
  exports: [TASK_FACADE, CreateTaskUseCase],
})
export class TaskModule {}
