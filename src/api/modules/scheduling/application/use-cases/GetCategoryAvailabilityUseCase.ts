import { Inject, Injectable } from '@nestjs/common';
import {
  CategoryAvailabilityRecord,
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';

export type GetCategoryAvailabilityInput = {
  tenantId: string;
  categoryId: string;
  date: string;
  branchId?: string | null;
};

@Injectable()
export class GetCategoryAvailabilityUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: GetCategoryAvailabilityInput,
  ): Promise<CategoryAvailabilityRecord[]> {
    return this.schedulingStore.listAvailabilityByCategory(
      input.tenantId,
      input.categoryId,
      input.date,
      input.branchId,
    );
  }
}
