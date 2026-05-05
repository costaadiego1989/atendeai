import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';

export type AssignProfessionalCategoriesInput = {
  tenantId: string;
  professionalId: string;
  categoryIds: string[];
};

@Injectable()
export class AssignProfessionalCategoriesUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(input: AssignProfessionalCategoriesInput): Promise<string[]> {
    return this.schedulingStore.assignCategoriesToProfessional(input);
  }
}
