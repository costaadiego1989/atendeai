import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
  SchedulingCategoryRecord,
} from '../../domain/ports/ISchedulingStore';

@Injectable()
export class ListSchedulingCategoriesUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]> {
    return this.schedulingStore.listCategories(tenantId, branchId);
  }
}
