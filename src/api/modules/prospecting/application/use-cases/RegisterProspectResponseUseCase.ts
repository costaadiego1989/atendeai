import { Inject, Injectable } from '@nestjs/common';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  IRegisterProspectResponseUseCase,
  RegisterProspectResponseInput,
  RegisterProspectResponseOutput,
} from './interfaces/IRegisterProspectResponseUseCase';

@Injectable()
export class RegisterProspectResponseUseCase implements IRegisterProspectResponseUseCase {
  constructor(
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
  ) {}

  async execute(
    input: RegisterProspectResponseInput,
  ): Promise<RegisterProspectResponseOutput | null> {
    const execution =
      await this.executionRepository.findLatestContactedByContact(
        input.tenantId,
        input.contactId,
      );

    if (!execution) {
      return null;
    }

    execution.markAsResponded();
    await this.executionRepository.save(execution);

    return {
      executionId: execution.id.toString(),
      status: execution.status.value,
    };
  }
}
