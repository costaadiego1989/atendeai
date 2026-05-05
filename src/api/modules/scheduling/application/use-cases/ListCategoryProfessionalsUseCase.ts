import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
  SchedulingProfessionalRecord,
} from '../../domain/ports/ISchedulingStore';

export type ListCategoryProfessionalsInput = {
  tenantId: string;
  categoryId: string;
  branchId?: string | null;
};

@Injectable()
export class ListCategoryProfessionalsUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: ListCategoryProfessionalsInput,
  ): Promise<SchedulingProfessionalRecord[]> {
    return this.schedulingStore.listProfessionalsByCategory(
      input.tenantId,
      input.categoryId,
      input.branchId,
    );
  }
}
