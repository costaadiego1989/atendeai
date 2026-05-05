import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface ListRecoveryCasesQuery {
  tenantId: string;
  branchId?: string;
  status?: string;
  source?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

@Injectable()
export class ListRecoveryCasesUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
  ) {}

  async execute(query: ListRecoveryCasesQuery) {
    return this.recoveryRepository.listCases(query);
  }
}
