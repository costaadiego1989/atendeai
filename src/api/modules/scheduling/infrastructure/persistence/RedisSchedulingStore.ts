import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  AvailabilitySlotRecord,
  CategoryAvailabilityRecord,
  MarkSlotPaymentConfirmedResult,
  ReserveAvailabilitySlotInput,
  SchedulingCategoryRecord,
  SchedulingProfessionalRecord,
  UpdateAvailabilitySlotInput,
} from '../../domain/ports/ISchedulingStore';
import { IAvailabilityStore } from '../../domain/ports/IAvailabilityStore';
import { IReservationStore } from '../../domain/ports/IReservationStore';
import { IPaymentStatusStore } from '../../domain/ports/IPaymentStatusStore';

@Injectable()
export class RedisSchedulingStore
  implements IAvailabilityStore, IReservationStore, IPaymentStatusStore
{
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async createProfessional(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    phone?: string;
    role?: string;
  }): Promise<SchedulingProfessionalRecord> {
    const professional: SchedulingProfessionalRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      phone: input.phone || null,
      role: input.role || null,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await this.redis.hset(
      this.getProfessionalsKey(input.tenantId),
      professional.id,
      JSON.stringify(professional),
    );

    return professional;
  }

  async listProfessionals(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]> {
    const records = await this.redis.hvals(this.getProfessionalsKey(tenantId));

    return records
      .map((record) => JSON.parse(record) as SchedulingProfessionalRecord)
      .filter((record) => !branchId || record.branchId === branchId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    unit: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
    durationMinutes?: number;
    basePrice?: number;
  }): Promise<SchedulingCategoryRecord> {
    const category: SchedulingCategoryRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      unit: input.unit,
      durationMinutes: input.durationMinutes ?? null,
      basePrice: input.basePrice ?? null,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await this.redis.hset(
      this.getCategoriesKey(input.tenantId),
      category.id,
      JSON.stringify(category),
    );

    return category;
  }

  async listCategories(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]> {
    const records = await this.redis.hvals(this.getCategoriesKey(tenantId));

    return records
      .map((record) => JSON.parse(record) as SchedulingCategoryRecord)
      .filter((record) => !branchId || record.branchId === branchId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async assignCategoriesToProfessional(input: {
    tenantId: string;
    professionalId: string;
    categoryIds: string[];
  }): Promise<string[]> {
    const professionalCategoriesKey = this.getProfessionalCategoriesKey(
      input.tenantId,
      input.professionalId,
    );
    const currentCategoryIds = await this.redis.smembers(
      professionalCategoriesKey,
    );

    const multi = this.redis.multi();

    if (currentCategoryIds.length > 0) {
      multi.del(professionalCategoriesKey);

      for (const categoryId of currentCategoryIds) {
        multi.srem(
          this.getCategoryProfessionalsKey(input.tenantId, categoryId),
          input.professionalId,
        );
      }
    }

    if (input.categoryIds.length > 0) {
      multi.sadd(professionalCategoriesKey, ...input.categoryIds);

      for (const categoryId of input.categoryIds) {
        multi.sadd(
          this.getCategoryProfessionalsKey(input.tenantId, categoryId),
          input.professionalId,
        );
      }
    }

    await multi.exec();

    return input.categoryIds;
  }

  async listProfessionalsByCategory(
    tenantId: string,
    categoryId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]> {
    const professionalIds = await this.redis.smembers(
      this.getCategoryProfessionalsKey(tenantId, categoryId),
    );

    if (professionalIds.length === 0) {
      return [];
    }

    const professionals = await this.listProfessionals(tenantId, branchId);

    return professionals.filter((professional) =>
      professionalIds.includes(professional.id),
    );
  }

  async saveAvailability(input: {
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
  }): Promise<AvailabilitySlotRecord[]> {
    const key = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.date,
    );
    const existingRawSlots = await this.redis.hgetall(key);
    const nextSlots = input.slots
      .map((slot) => {
        const slotId = this.makeSlotId(input.date, slot.startsAt, slot.endsAt);
        const existing = existingRawSlots[slotId]
          ? (JSON.parse(existingRawSlots[slotId]) as AvailabilitySlotRecord)
          : null;

        if (
          existing?.status === 'PRE_RESERVED' ||
          existing?.status === 'RESERVED' ||
          existing?.status === 'COMPLETED' ||
          existing?.status === 'NO_SHOW' ||
          existing?.status === 'BLOCKED'
        ) {
          return existing;
        }

        return {
          id: slotId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          label: slot.label || null,
          customPrice: slot.customPrice ?? null,
          isOnline: slot.isOnline ?? false,
          status: 'AVAILABLE' as const,
        };
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const serializedEntries = nextSlots.flatMap((slot) => [
      slot.id,
      JSON.stringify(slot),
    ]);

    await this.redis.del(key);

    if (serializedEntries.length > 0) {
      await this.redis.hset(key, ...serializedEntries);
      await this.redis.expire(key, this.getSlotTtlSeconds(input.date));
    }

    return nextSlots;
  }

  async listAvailability(
    tenantId: string,
    professionalId: string,
    date: string,
  ): Promise<AvailabilitySlotRecord[]> {
    const key = this.getAvailabilityKey(tenantId, professionalId, date);
    const records = await this.redis.hvals(key);

    return records
      .map((record) => JSON.parse(record) as AvailabilitySlotRecord)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getAvailabilitySlot(
    tenantId: string,
    professionalId: string,
    date: string,
    slotId: string,
  ): Promise<AvailabilitySlotRecord | null> {
    const key = this.getAvailabilityKey(tenantId, professionalId, date);
    const rawSlot = await this.redis.hget(key, slotId);

    return rawSlot ? (JSON.parse(rawSlot) as AvailabilitySlotRecord) : null;
  }

  async listAvailabilityByCategory(
    tenantId: string,
    categoryId: string,
    date: string,
    branchId?: string | null,
  ): Promise<CategoryAvailabilityRecord[]> {
    const professionals = await this.listProfessionalsByCategory(
      tenantId,
      categoryId,
      branchId,
    );
    const availability = await Promise.all(
      professionals.map(async (professional) => ({
        professionalId: professional.id,
        professionalName: professional.name,
        slots: await this.listAvailability(tenantId, professional.id, date),
      })),
    );

    return availability.filter((entry) => entry.slots.length > 0);
  }

  async reserveSlot(
    input: ReserveAvailabilitySlotInput,
  ): Promise<AvailabilitySlotRecord | null> {
    const key = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.date,
    );

    await this.redis.watch(key);

    try {
      const rawSlot = await this.redis.hget(key, input.slotId);

      if (!rawSlot) {
        await this.redis.unwatch();
        return null;
      }

      const slot = JSON.parse(rawSlot) as AvailabilitySlotRecord;

      if (slot.status !== 'AVAILABLE') {
        await this.redis.unwatch();
        return null;
      }

      const reservedSlot: AvailabilitySlotRecord = {
        ...slot,
        status: input.status ?? 'RESERVED',
        reservedAt: new Date().toISOString(),
        payment: undefined,
        reservedFor: {
          contactId: input.contactId,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          contactEmail: input.contactEmail,
          categoryId: input.categoryId,
          categoryName: input.categoryName,
          conversationId: input.conversationId,
          notes: input.notes,
          isOnline: input.isOnline ?? slot.isOnline,
        },
      };

      const execResult = await this.redis
        .multi()
        .hset(key, input.slotId, JSON.stringify(reservedSlot))
        .exec();

      if (!execResult) {
        return null;
      }

      return reservedSlot;
    } finally {
      await this.redis.unwatch();
    }
  }

  async updateSlot(
    input: UpdateAvailabilitySlotInput,
  ): Promise<AvailabilitySlotRecord | null> {
    const key = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.date,
    );

    await this.redis.watch(key);

    try {
      const rawSlot = await this.redis.hget(key, input.slotId);

      if (!rawSlot) {
        await this.redis.unwatch();
        return null;
      }

      const slot = JSON.parse(rawSlot) as AvailabilitySlotRecord;
      let nextSlot: AvailabilitySlotRecord | null = null;

      if (input.action === 'BLOCK') {
        nextSlot = {
          ...slot,
          status: 'BLOCKED',
        };
      }

      if (input.action === 'UNBLOCK') {
        nextSlot = {
          ...slot,
          status: 'AVAILABLE',
          reservedAt: undefined,
          payment: undefined,
          reservedFor: undefined,
        };
      }

      if (input.action === 'CANCEL_RESERVATION') {
        nextSlot = {
          ...slot,
          status: 'AVAILABLE',
          reservedAt: undefined,
          payment: undefined,
          reservedFor: undefined,
        };
      }

      if (input.action === 'UPDATE_RESERVATION') {
        if (slot.status !== 'RESERVED' && slot.status !== 'PRE_RESERVED') {
          await this.redis.unwatch();
          return null;
        }

        nextSlot = {
          ...slot,
          reservedFor: {
            ...slot.reservedFor,
            contactId: input.contactId ?? slot.reservedFor?.contactId,
            contactName: input.contactName ?? slot.reservedFor?.contactName,
            contactPhone: input.contactPhone ?? slot.reservedFor?.contactPhone,
            contactEmail: input.contactEmail ?? slot.reservedFor?.contactEmail,
            categoryId: input.categoryId ?? slot.reservedFor?.categoryId,
            categoryName: input.categoryName ?? slot.reservedFor?.categoryName,
            conversationId:
              input.conversationId ?? slot.reservedFor?.conversationId,
            notes: input.notes ?? slot.reservedFor?.notes,
            isOnline: input.isOnline ?? slot.reservedFor?.isOnline,
            meetingProvider:
              input.meetingProvider ?? slot.reservedFor?.meetingProvider,
            meetingUrl: input.meetingUrl ?? slot.reservedFor?.meetingUrl,
          },
        };
      }

      if (
        input.action === 'MARK_COMPLETED' ||
        input.action === 'MARK_NO_SHOW'
      ) {
        if (slot.status !== 'RESERVED') {
          await this.redis.unwatch();
          return null;
        }

        nextSlot = {
          ...slot,
          status: input.action === 'MARK_COMPLETED' ? 'COMPLETED' : 'NO_SHOW',
          reservedFor: {
            ...slot.reservedFor,
            notes: input.notes ?? slot.reservedFor?.notes,
          },
        };
      }

      if (!nextSlot) {
        await this.redis.unwatch();
        return null;
      }

      const execResult = await this.redis
        .multi()
        .hset(key, input.slotId, JSON.stringify(nextSlot))
        .exec();

      if (!execResult) {
        return null;
      }

      return nextSlot;
    } finally {
      await this.redis.unwatch();
    }
  }

  async rescheduleReservation(input: {
    tenantId: string;
    professionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetDate: string;
    targetSlotId: string;
  }): Promise<{
    sourceSlot: AvailabilitySlotRecord;
    targetSlot: AvailabilitySlotRecord;
  } | null> {
    const sourceKey = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.sourceDate,
    );
    const targetKey = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.targetDate,
    );

    await this.redis.watch(sourceKey, targetKey);

    try {
      const [rawSourceSlot, rawTargetSlot] = await Promise.all([
        this.redis.hget(sourceKey, input.sourceSlotId),
        this.redis.hget(targetKey, input.targetSlotId),
      ]);

      if (!rawSourceSlot || !rawTargetSlot) {
        await this.redis.unwatch();
        return null;
      }

      const sourceSlot = JSON.parse(rawSourceSlot) as AvailabilitySlotRecord;
      const targetSlot = JSON.parse(rawTargetSlot) as AvailabilitySlotRecord;

      if (
        (sourceSlot.status !== 'RESERVED' &&
          sourceSlot.status !== 'PRE_RESERVED') ||
        targetSlot.status !== 'AVAILABLE'
      ) {
        await this.redis.unwatch();
        return null;
      }

      const clearedSourceSlot: AvailabilitySlotRecord = {
        ...sourceSlot,
        status: 'AVAILABLE',
        reservedAt: undefined,
        payment: undefined,
        reservedFor: undefined,
      };

      const rescheduledTargetSlot: AvailabilitySlotRecord = {
        ...targetSlot,
        label: sourceSlot.label ?? targetSlot.label ?? null,
        customPrice: sourceSlot.customPrice ?? targetSlot.customPrice ?? null,
        status: sourceSlot.status,
        reservedAt: sourceSlot.reservedAt,
        payment: sourceSlot.payment,
        reservedFor: sourceSlot.reservedFor,
      };

      const execResult = await this.redis
        .multi()
        .hset(sourceKey, input.sourceSlotId, JSON.stringify(clearedSourceSlot))
        .hset(
          targetKey,
          input.targetSlotId,
          JSON.stringify(rescheduledTargetSlot),
        )
        .exec();

      if (!execResult) {
        return null;
      }

      return {
        sourceSlot: clearedSourceSlot,
        targetSlot: rescheduledTargetSlot,
      };
    } finally {
      await this.redis.unwatch();
    }
  }

  async attachPaymentLinkToReservedSlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    reference: string;
    linkId: string;
    linkUrl: string;
    amount: number;
    billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
    expiresAt?: string;
  }): Promise<AvailabilitySlotRecord | null> {
    const key = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.date,
    );

    await this.redis.watch(key);

    try {
      const rawSlot = await this.redis.hget(key, input.slotId);

      if (!rawSlot) {
        await this.redis.unwatch();
        return null;
      }

      const slot = JSON.parse(rawSlot) as AvailabilitySlotRecord;

      if (slot.status !== 'RESERVED' && slot.status !== 'PRE_RESERVED') {
        await this.redis.unwatch();
        return null;
      }

      const nextSlot: AvailabilitySlotRecord = {
        ...slot,
        payment: {
          reference: input.reference,
          linkId: input.linkId,
          linkUrl: input.linkUrl,
          amount: input.amount,
          billingType: input.billingType,
          status: 'PENDING',
          expiresAt: input.expiresAt,
        },
      };

      const execResult = await this.redis
        .multi()
        .hset(key, input.slotId, JSON.stringify(nextSlot))
        .exec();

      if (!execResult) {
        return null;
      }

      return nextSlot;
    } finally {
      await this.redis.unwatch();
    }
  }

  async markSlotPaymentConfirmedByReference(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    paymentReference: string;
    confirmedAt: string;
  }): Promise<MarkSlotPaymentConfirmedResult> {
    const key = this.getAvailabilityKey(
      input.tenantId,
      input.professionalId,
      input.date,
    );

    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.redis.watch(key);

      try {
        const rawSlot = await this.redis.hget(key, input.slotId);

        if (!rawSlot) {
          await this.redis.unwatch();
          return { slot: null, appliedChange: false };
        }

        const slot = JSON.parse(rawSlot) as AvailabilitySlotRecord;

        if (slot.payment?.reference !== input.paymentReference) {
          await this.redis.unwatch();
          return { slot: null, appliedChange: false };
        }

        if (slot.payment?.status === 'PAID') {
          await this.redis.unwatch();
          return { slot, appliedChange: false };
        }

        const nextSlot: AvailabilitySlotRecord = {
          ...slot,
          status: slot.status === 'PRE_RESERVED' ? 'RESERVED' : slot.status,
          payment: {
            ...slot.payment,
            status: 'PAID',
            confirmedAt: input.confirmedAt,
          },
        };

        const execResult = await this.redis
          .multi()
          .hset(key, input.slotId, JSON.stringify(nextSlot))
          .exec();

        if (!execResult) {
          continue;
        }

        return { slot: nextSlot, appliedChange: true };
      } finally {
        await this.redis.unwatch();
      }
    }

    return { slot: null, appliedChange: false };
  }

  async attachMeetingLinkToReservedSlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    meetingProvider: 'GOOGLE_MEET';
    meetingUrl: string;
  }): Promise<AvailabilitySlotRecord | null> {
    return this.updateSlot({
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      date: input.date,
      slotId: input.slotId,
      action: 'UPDATE_RESERVATION',
      isOnline: true,
      meetingProvider: input.meetingProvider,
      meetingUrl: input.meetingUrl,
    });
  }

  private getProfessionalsKey(tenantId: string): string {
    return `scheduling:tenant:${tenantId}:professionals`;
  }

  private getCategoriesKey(tenantId: string): string {
    return `scheduling:tenant:${tenantId}:categories`;
  }

  private getProfessionalCategoriesKey(
    tenantId: string,
    professionalId: string,
  ): string {
    return `scheduling:tenant:${tenantId}:professional:${professionalId}:categories`;
  }

  private getCategoryProfessionalsKey(
    tenantId: string,
    categoryId: string,
  ): string {
    return `scheduling:tenant:${tenantId}:category:${categoryId}:professionals`;
  }

  private getAvailabilityKey(
    tenantId: string,
    professionalId: string,
    date: string,
  ): string {
    return `scheduling:tenant:${tenantId}:professional:${professionalId}:availability:${date}`;
  }

  private makeSlotId(date: string, startsAt: string, endsAt: string): string {
    return `${date}__${startsAt}__${endsAt}`;
  }

  private getSlotTtlSeconds(date: string): number {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const ttlInSeconds = Math.floor((endOfDay.getTime() - Date.now()) / 1000);

    return Math.max(ttlInSeconds + 60 * 60 * 24 * 2, 60 * 60);
  }
}
