import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
} from '../ports/IAutomationRepository';
import { AutomationEntity } from '../../domain/entities/Automation';

@Injectable()
export class ListAutomationsUseCase {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: IAutomationRepository,
  ) {}

  async execute(tenantId: string, onlyActive?: boolean): Promise<AutomationEntity[]> {
    return this.repository.findAllByTenant(tenantId, onlyActive);
  }
}
