import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  MANUAL_AUTOMATION_FACADE,
  IManualAutomationFacade,
} from '../ports/IManualAutomationFacade';

export interface ExtractAndDispatchInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  text: string;
}

export interface ExtractAndDispatchResult {
  finalText: string;
  dispatchedCount: number;
}

@Injectable()
export class AIAutomationDispatcher {
  private readonly logger = new Logger(AIAutomationDispatcher.name);

  constructor(
    @Optional()
    @Inject(MANUAL_AUTOMATION_FACADE)
    private readonly manualAutomationFacade?: IManualAutomationFacade,
  ) {}

  async extractAndDispatch(
    params: ExtractAndDispatchInput,
  ): Promise<ExtractAndDispatchResult> {
    const { tenantId, contactId, conversationId, text } = params;

    const ids: string[] = [];
    const cleanedText = text.replace(
      /\[USE_AUTOMATION:([0-9a-f-]{36})\]/gi,
      (_, id: string) => {
        ids.push(id);
        return '';
      },
    );

    if (ids.length > 0) {
      await this.dispatchAll(tenantId, contactId, conversationId, ids);
    }

    return {
      finalText: cleanedText,
      dispatchedCount: ids.length,
    };
  }

  private async dispatchAll(
    tenantId: string,
    contactId: string,
    conversationId: string,
    automationIds: string[],
  ): Promise<void> {
    if (!this.manualAutomationFacade) return;

    for (const automationId of automationIds) {
      try {
        await this.manualAutomationFacade.dispatch(
          tenantId,
          automationId,
          contactId,
          conversationId,
          'AI',
        );
        this.logger.log(
          `AI triggered automation ${automationId} for contact ${contactId}`,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `dispatchAITriggeredAutomations: failed for automation ${automationId} — ${String(err)}`,
        );
      }
    }
  }
}
