import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
  SchedulingCategoryUnit,
  SchedulingCategoryRecord,
} from '../../domain/ports/ISchedulingStore';

export type CreateSchedulingCategoryInput = {
  tenantId: string;
  branchId?: string | null;
  name: string;
  unit: SchedulingCategoryUnit;
  durationMinutes?: number;
  basePrice?: number;
};

@Injectable()
export class CreateSchedulingCategoryUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: CreateSchedulingCategoryInput,
  ): Promise<SchedulingCategoryRecord> {
    return this.schedulingStore.createCategory(input);
  }
}
