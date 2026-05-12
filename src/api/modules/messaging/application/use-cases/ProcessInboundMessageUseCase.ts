import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import {
  IProcessInboundMessageUseCase,
  ProcessInboundMessageInput,
} from './interfaces/IProcessInboundMessageUseCase';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { InboundMessagePipeline } from '../services/inbound-pipeline/InboundMessagePipeline';

@Injectable()
export class ProcessInboundMessageUseCase implements IProcessInboundMessageUseCase {
  constructor(
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    private readonly pipeline: InboundMessagePipeline,
  ) {}

  async execute(input: ProcessInboundMessageInput): Promise<void> {
    await this.transactionalEventPublisher.execute(async (tx) => {
      const events = await this.persistInboundMessage(input, { tx });
      return {
        result: undefined,
        events,
      };
    });
  }

  async persistInboundMessage(
    input: ProcessInboundMessageInput,
    options?: { tx?: Prisma.TransactionClient; skipDuplicateCheck?: boolean },
  ): Promise<IntegrationEvent[]> {
    return this.pipeline.execute(input, options);
  }
}
