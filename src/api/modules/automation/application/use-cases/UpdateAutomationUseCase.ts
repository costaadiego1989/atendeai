import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';
import { AutomationEntity } from '../../domain/entities/Automation';

export interface UpdateAutomationInput {
  tenantId: string;
  automationId: string;
  name?: string;
  description?: string;
  trigger?: any;
  conditions?: Record<string, unknown>[];
  steps?: { type: string; config: Record<string, unknown>; order: number }[];
  isActive?: boolean;
}

@Injectable()
export class UpdateAutomationUseCase {
  private readonly logger = new Logger(UpdateAutomationUseCase.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
  ) {}

  async execute(input: UpdateAutomationInput): Promise<AutomationEntity> {
    const existing = await this.repository.findById(input.tenantId, input.automationId);
    if (!existing) {
      throw new Error(`Automation ${input.automationId} not found`);
    }

    const updateData: Partial<AutomationEntity> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.trigger !== undefined) updateData.trigger = input.trigger;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.steps !== undefined) {
      updateData.steps = input.steps.map((s, idx) => ({
        id: '',
        automationId: input.automationId,
        order: s.order ?? idx,
        type: s.type,
        config: s.config,
        nextStepId: null,
      }));
    }

    return this.repository.update(input.tenantId, input.automationId, updateData);
  }
}
