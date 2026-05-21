import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';

@Injectable()
export class DeleteAutomationUseCase {
  private readonly logger = new Logger(DeleteAutomationUseCase.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
  ) {}

  async execute(tenantId: string, automationId: string): Promise<void> {
    const existing = await this.repository.findById(tenantId, automationId);
    if (!existing) {
      throw new Error(`Automation ${automationId} not found`);
    }

    await this.repository.delete(tenantId, automationId);
    this.logger.log(
      `Deleted automation ${automationId} for tenant ${tenantId}`,
    );
  }
}
