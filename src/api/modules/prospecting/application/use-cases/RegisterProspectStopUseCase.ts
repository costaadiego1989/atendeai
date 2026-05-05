import { Inject, Injectable } from '@nestjs/common';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import { ProspectStopReasonVO } from '../../domain/value-objects/ProspectStopReason';
import {
  IRegisterProspectStopUseCase,
  RegisterProspectStopInput,
  RegisterProspectStopOutput,
} from './interfaces/IRegisterProspectStopUseCase';

@Injectable()
export class RegisterProspectStopUseCase
  implements IRegisterProspectStopUseCase
{
  constructor(
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
  ) {}

  async execute(
    input: RegisterProspectStopInput,
  ): Promise<RegisterProspectStopOutput | null> {
    const execution =
      await this.executionRepository.findLatestContactedByContact(
        input.tenantId,
        input.contactId,
      );

    if (!execution) {
      return null;
    }

    execution.markAsStopped(ProspectStopReasonVO.create('OPT_OUT'));
    await this.executionRepository.save(execution);

    return {
      executionId: execution.id.toString(),
      status: execution.status.value,
      stopReason: execution.stopReason?.value ?? 'OPT_OUT',
    };
  }
}
