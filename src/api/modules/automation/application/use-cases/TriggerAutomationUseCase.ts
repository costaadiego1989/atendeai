import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';
import { ExecuteAutomationUseCase } from './ExecuteAutomationUseCase';

/**
 * Handles incoming domain events and triggers matching automations.
 * This is the bridge between the event bus and the automation engine.
 */
@Injectable()
export class TriggerAutomationUseCase {
  private readonly logger = new Logger(TriggerAutomationUseCase.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
    private readonly executeUseCase: ExecuteAutomationUseCase,
  ) {}

  /**
   * Find and execute all active automations matching the trigger type for a tenant.
   */
  async execute(
    tenantId: string,
    triggerType: string,
    payload: Record<string, unknown>,
    contactId?: string,
  ): Promise<string[]> {
    const automations = await this.repository.findByTriggerType(tenantId, triggerType);

    if (automations.length === 0) {
      return [];
    }

    this.logger.log(
      `Found ${automations.length} automations for trigger "${triggerType}" in tenant ${tenantId}`,
    );

    const executionIds: string[] = [];

    for (const automation of automations) {
      try {
        const executionId = await this.executeUseCase.execute({
          tenantId,
          automationId: automation.id,
          contactId,
          triggerPayload: payload,
        });
        if (executionId) {
          executionIds.push(executionId);
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to trigger automation ${automation.id}: ${error.message}`,
        );
      }
    }

    return executionIds;
  }
}
