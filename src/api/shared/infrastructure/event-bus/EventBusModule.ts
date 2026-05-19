import { Global, Module } from '@nestjs/common';
import { BullMQEventBus } from './BullMQEventBus';
import { EVENT_BUS } from '../../application/ports/IEventBus';
import { OutboxEventBus } from './OutboxEventBus';
import { PrismaOutboxStore } from './PrismaOutboxStore';
import { OutboxDispatcher } from './OutboxDispatcher';
import { DatabaseModule } from '../database/DatabaseModule';
import { RedisModule } from '../redis/RedisModule';
import { RabbitMQEventBus } from './RabbitMQEventBus';
import { PrismaInboxStore } from './PrismaInboxStore';
import { PrismaTransactionalEventPublisher } from './PrismaTransactionalEventPublisher';

@Global()
@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [
    BullMQEventBus,
    RabbitMQEventBus,
    PrismaOutboxStore,
    PrismaInboxStore,
    PrismaTransactionalEventPublisher,
    OutboxDispatcher,
    {
      provide: EVENT_BUS,
      useClass: OutboxEventBus,
    },
  ],
  exports: [EVENT_BUS, PrismaTransactionalEventPublisher],
})
export class EventBusModule {}
