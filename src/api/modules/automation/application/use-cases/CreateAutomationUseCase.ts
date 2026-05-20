import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';
import { AutomationEntity } from '../../domain/entities/Automation';
import { TriggerConfig } from '../../domain/value-objects/TriggerType';

export interface CreateAutomationInput {
  tenantId: string;
  name: string;
  description?: string;
  trigger: TriggerConfig;
  conditions?: Record<string, unknown>[];
  steps: { type: string; config: Record<string, unknown>; order: number }[];
}

@Injectable()
export class CreateAutomationUseCase {
  private readonly logger = new Logger(CreateAutomationUseCase.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
  ) {}

  async execute(input: CreateAutomationInput): Promise<AutomationEntity> {
    this.logger.log(`Creating automation "${input.name}" for tenant ${input.tenantId}`);

    const automation = await this.repository.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description || null,
      isActive: false,
      trigger: input.trigger,
      conditions: input.conditions || [],
      steps: input.steps.map((s, idx) => ({
        id: '',
        automationId: '',
        order: s.order ?? idx,
        type: s.type,
        config: s.config,
        nextStepId: null,
      })),
    });

    return automation;
  }
}
