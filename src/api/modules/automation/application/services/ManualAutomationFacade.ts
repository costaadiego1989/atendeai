import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IManualAutomationFacade,
  ManualAutomationSummary,
} from '@modules/ai/application/ports/IManualAutomationFacade';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';
import { TriggerAutomationUseCase } from '../use-cases/TriggerAutomationUseCase';
import { TriggerType } from '../../domain/value-objects/TriggerType';

@Injectable()
export class ManualAutomationFacade implements IManualAutomationFacade {
  private readonly logger = new Logger(ManualAutomationFacade.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
    private readonly triggerUseCase: TriggerAutomationUseCase,
  ) {}

  async listActive(tenantId: string): Promise<ManualAutomationSummary[]> {
    const automations = await this.repository.findByTriggerType(
      tenantId,
      TriggerType.MANUAL,
    );
    return automations
      .filter((a) => a.isActive)
      .map((a) => ({ id: a.id, name: a.name, description: a.description }));
  }

  async dispatch(
    tenantId: string,
    automationId: string,
    contactId: string,
    conversationId: string,
    triggeredBy: 'AI' | 'HUMAN',
  ): Promise<void> {
    await this.triggerUseCase.execute(
      tenantId,
      TriggerType.MANUAL,
      { automationId, conversationId, triggeredBy },
      contactId,
    );
    this.logger.log(
      `ManualAutomationFacade: dispatched automation ${automationId} by ${triggeredBy} for contact ${contactId}`,
    );
  }
}
