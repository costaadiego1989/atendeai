import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceDeliveryScheduleRecord,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

export interface ConfigureShippingPolicyInput {
  tenantId: string;
  mode: 'FIXED' | 'PER_KM';
  fixedAmount?: number | null;
  pricePerKm?: number | null;
  minimumAmount?: number | null;
  maxRadiusKm?: number | null;
  servicedNeighborhoods?: string[] | null;
  deliverySchedule?: CommerceDeliveryScheduleRecord[] | null;
  notes?: string | null;
  active?: boolean;
}

@Injectable()
export class ConfigureShippingPolicyUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(input: ConfigureShippingPolicyInput) {
    if (input.mode === 'FIXED' && (input.fixedAmount == null || input.fixedAmount < 0)) {
      throw new BadRequestException('Fixed shipping amount must be informed');
    }

    if (input.mode === 'PER_KM' && (input.pricePerKm == null || input.pricePerKm < 0)) {
      throw new BadRequestException('Price per km must be informed');
    }

    const normalizedSchedule = (input.deliverySchedule ?? []).map((slot) => ({
      weekday: slot.weekday,
      enabled: Boolean(slot.enabled),
      startTime: slot.enabled ? slot.startTime?.trim() || null : null,
      endTime: slot.enabled ? slot.endTime?.trim() || null : null,
    }));

    return this.commerceRepository.upsertShippingPolicy({
      tenantId: input.tenantId,
      mode: input.mode,
      fixedAmount: input.fixedAmount ?? null,
      pricePerKm: input.pricePerKm ?? null,
      minimumAmount: input.minimumAmount ?? null,
      maxRadiusKm: input.maxRadiusKm ?? null,
      servicedNeighborhoods:
        input.servicedNeighborhoods
          ?.map((value) => value.trim())
          .filter(Boolean) ?? [],
      deliverySchedule: normalizedSchedule,
      notes: input.notes ?? null,
      active: input.active ?? true,
    });
  }
}
