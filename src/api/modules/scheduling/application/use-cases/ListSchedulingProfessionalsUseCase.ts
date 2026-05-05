import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
  SchedulingProfessionalRecord,
} from '../../domain/ports/ISchedulingStore';

@Injectable()
export class ListSchedulingProfessionalsUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]> {
    return this.schedulingStore.listProfessionals(tenantId, branchId);
  }
}
