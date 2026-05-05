import { Inject, Injectable } from '@nestjs/common';
import {
  AvailabilitySlotRecord,
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';

export type SetProfessionalAvailabilityInput = {
  tenantId: string;
  professionalId: string;
  date: string;
  slots: Array<{
    startsAt: string;
    endsAt: string;
    label?: string;
    customPrice?: number;
    isOnline?: boolean;
  }>;
};

@Injectable()
export class SetProfessionalAvailabilityUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
  ) {}

  async execute(
    input: SetProfessionalAvailabilityInput,
  ): Promise<AvailabilitySlotRecord[]> {
    return this.schedulingStore.saveAvailability(input);
  }
}
