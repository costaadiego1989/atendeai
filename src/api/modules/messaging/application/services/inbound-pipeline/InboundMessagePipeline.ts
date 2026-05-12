import { Injectable } from '@nestjs/common';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { ProcessInboundMessageInput } from '../../use-cases/interfaces/IProcessInboundMessageUseCase';
import { DeduplicateMessageStep } from './DeduplicateMessageStep';
import { IdentifyContactStep } from './IdentifyContactStep';
import { EnsureConversationStep } from './EnsureConversationStep';
import { PersistMessageStep } from './PersistMessageStep';
import { AnalyzeMessageStep } from './AnalyzeMessageStep';
import { DispatchReplyStep } from './DispatchReplyStep';
import { InboundMessageContext } from './InboundMessageContext';
import { Prisma } from '@prisma/client';

@Injectable()
export class InboundMessagePipeline {
  constructor(
    private readonly deduplicateStep: DeduplicateMessageStep,
    private readonly identifyContactStep: IdentifyContactStep,
    private readonly ensureConversationStep: EnsureConversationStep,
    private readonly persistMessageStep: PersistMessageStep,
    private readonly analyzeMessageStep: AnalyzeMessageStep,
    private readonly dispatchReplyStep: DispatchReplyStep,
  ) {}

  async execute(
    input: ProcessInboundMessageInput,
    options?: { tx?: Prisma.TransactionClient; skipDuplicateCheck?: boolean },
  ): Promise<IntegrationEvent[]> {
    let ctx: InboundMessageContext = {
      input,
      tx: options?.tx,
      skipDuplicateCheck: options?.skipDuplicateCheck,
      events: [],
    };

    // Step 1: Deduplicate
    ctx = await this.deduplicateStep.execute(ctx);
    if (ctx.isDuplicate) {
      return [];
    }

    // Step 2: Identify contact
    ctx = await this.identifyContactStep.execute(ctx);

    // Step 3: Ensure conversation exists
    ctx = await this.ensureConversationStep.execute(ctx);

    // Step 4: Persist message
    ctx = await this.persistMessageStep.execute(ctx);

    // Step 5: Analyze (intelligence)
    ctx = await this.analyzeMessageStep.execute(ctx);

    // Step 6: Dispatch reply events
    ctx = await this.dispatchReplyStep.execute(ctx);

    return ctx.events;
  }
}
