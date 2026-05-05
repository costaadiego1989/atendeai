import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EVENT_BUS, IEventBus } from '../../application/ports/IEventBus';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';
import { PrismaService } from '../database/PrismaService';
import { PrismaOutboxStore } from './PrismaOutboxStore';

export interface TransactionalWorkResult<T> {
  result: T;
  events?: IntegrationEvent[];
}

@Injectable()
export class PrismaTransactionalEventPublisher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxStore: PrismaOutboxStore,
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute<T>(
    work: (
      tx: Prisma.TransactionClient,
    ) => Promise<TransactionalWorkResult<T>>,
  ): Promise<T> {
    const useOutbox = this.getMode() === 'outbox';
    let pendingEvents: IntegrationEvent[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const outcome = await work(tx);
      pendingEvents = outcome.events ?? [];

      if (useOutbox) {
        for (const event of pendingEvents) {
          await this.outboxStore.append(event, tx);
        }
      }

      return outcome.result;
    });

    if (!useOutbox) {
      for (const event of pendingEvents) {
        await this.eventBus.publish(event);
      }
    }

    return result;
  }

  private getMode(): 'immediate' | 'outbox' {
    return this.configService.get<'immediate' | 'outbox'>(
      'EVENT_BUS_MODE',
      'immediate',
    );
  }
}
