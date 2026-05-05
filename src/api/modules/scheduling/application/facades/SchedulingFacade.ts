import { Injectable, Inject } from '@nestjs/common';
import {
  CategoryAvailabilityRecord,
  SchedulingCategoryRecord,
} from '../../domain/ports/ISchedulingStore';
import {
  GetCategoryAvailabilityUseCase,
  GetCategoryAvailabilityInput,
} from '../use-cases/GetCategoryAvailabilityUseCase';
import { ListSchedulingCategoriesUseCase } from '../use-cases/ListSchedulingCategoriesUseCase';
import { ListSchedulingProfessionalsUseCase } from '../use-cases/ListSchedulingProfessionalsUseCase';
import { SchedulingProfessionalRecord } from '../../domain/ports/ISchedulingStore';

export interface ISchedulingFacade {
  listCategories(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]>;
  listProfessionals(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]>;
  getCategoryAvailability(
    input: GetCategoryAvailabilityInput,
  ): Promise<CategoryAvailabilityRecord[]>;
}

export const SCHEDULING_FACADE = 'SCHEDULING_FACADE';

@Injectable()
export class SchedulingFacade implements ISchedulingFacade {
  constructor(
    private readonly listSchedulingCategoriesUseCase: ListSchedulingCategoriesUseCase,
    private readonly listSchedulingProfessionalsUseCase: ListSchedulingProfessionalsUseCase,
    private readonly getCategoryAvailabilityUseCase: GetCategoryAvailabilityUseCase,
  ) {}

  async listCategories(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]> {
    return this.listSchedulingCategoriesUseCase.execute(tenantId, branchId);
  }

  async listProfessionals(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]> {
    return this.listSchedulingProfessionalsUseCase.execute(tenantId, branchId);
  }

  async getCategoryAvailability(
    input: GetCategoryAvailabilityInput,
  ): Promise<CategoryAvailabilityRecord[]> {
    return this.getCategoryAvailabilityUseCase.execute(input);
  }
}
