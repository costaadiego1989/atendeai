import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
  SchedulingProfessionalRecord,
} from '../../domain/ports/ISchedulingStore';

export type CreateSchedulingProfessionalInput = {
  tenantId: string;
  branchId?: string | null;
  name: string;
  phone?: string;
  role?: string;
};

@Injectable()
export class CreateSchedulingProfessionalUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: CreateSchedulingProfessionalInput,
  ): Promise<SchedulingProfessionalRecord> {
    return this.schedulingStore.createProfessional(input);
  }
}
