import { Inject, Injectable } from '@nestjs/common';
import {
  AvailabilitySlotRecord,
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';

export type GetProfessionalAvailabilityInput = {
  tenantId: string;
  professionalId: string;
  date: string;
};

@Injectable()
export class GetProfessionalAvailabilityUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: GetProfessionalAvailabilityInput,
  ): Promise<AvailabilitySlotRecord[]> {
    return this.schedulingStore.listAvailability(
      input.tenantId,
      input.professionalId,
      input.date,
    );
  }
}
