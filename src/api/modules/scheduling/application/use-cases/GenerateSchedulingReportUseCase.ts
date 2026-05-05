import { BadRequestException, Injectable } from '@nestjs/common';
import { AvailabilitySlotRecord } from '../../domain/ports/ISchedulingStore';
import { GetProfessionalAvailabilityUseCase } from './GetProfessionalAvailabilityUseCase';
import { ListSchedulingCategoriesUseCase } from './ListSchedulingCategoriesUseCase';
import { ListSchedulingProfessionalsUseCase } from './ListSchedulingProfessionalsUseCase';

export type GenerateSchedulingReportInput = {
  tenantId: string;
  branchId?: string | null;
  startDate: string;
  endDate: string;
  professionalIds?: string[] | null;
  categoryIds?: string[] | null;
  statuses?:
    | Array<'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED'>
    | null;
};

export type GenerateSchedulingReportRow = {
  professionalId: string;
  professionalName: string;
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  label?: string | null;
  status: AvailabilitySlotRecord['status'];
  categoryId?: string | null;
  categoryName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  reservedAt?: string | null;
  notes?: string | null;
  customPrice?: number | null;
  resolvedPrice?: number | null;
  paymentStatus?: 'PENDING' | 'PAID' | null;
  paymentReference?: string | null;
};

export type GenerateSchedulingReportOutput = {
  generatedAt: Date;
  summary: {
    totalSlots: number;
    reservedSlots: number;
    blockedSlots: number;
    availableSlots: number;
    completedSlots: number;
    noShowSlots: number;
    estimatedRevenue: number;
  };
  rows: GenerateSchedulingReportRow[];
};

@Injectable()
export class GenerateSchedulingReportUseCase {
  constructor(
    private readonly listSchedulingProfessionalsUseCase: ListSchedulingProfessionalsUseCase,
    private readonly listSchedulingCategoriesUseCase: ListSchedulingCategoriesUseCase,
    private readonly getProfessionalAvailabilityUseCase: GetProfessionalAvailabilityUseCase,
  ) { }

  async execute(
    input: GenerateSchedulingReportInput,
  ): Promise<GenerateSchedulingReportOutput> {
    const dates = this.buildDatesBetween(input.startDate, input.endDate);
    const [professionals, categories] = await Promise.all([
      this.listSchedulingProfessionalsUseCase.execute(input.tenantId, input.branchId),
      this.listSchedulingCategoriesUseCase.execute(input.tenantId, input.branchId),
    ]);

    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    const professionalIds = (input.professionalIds ?? []).filter(Boolean);
    const categoryIds = new Set((input.categoryIds ?? []).filter(Boolean));
    const statuses = new Set((input.statuses ?? []).filter(Boolean));

    const selectedProfessionals = professionalIds.length
      ? professionals.filter((professional) => professionalIds.includes(professional.id))
      : professionals;

    const rows: GenerateSchedulingReportRow[] = [];

    for (const professional of selectedProfessionals) {
      const availabilityByDate = await Promise.all(
        dates.map((date) =>
          this.getProfessionalAvailabilityUseCase.execute({
            tenantId: input.tenantId,
            professionalId: professional.id,
            date,
          }),
        ),
      );

      availabilityByDate.forEach((slots, index) => {
        const date = dates[index]!;

        slots.forEach((slot) => {
          const matchesStatus = statuses.size === 0 || statuses.has(slot.status);
          const matchesCategory =
            categoryIds.size === 0 ||
            (slot.reservedFor?.categoryId != null && categoryIds.has(slot.reservedFor.categoryId));

          if (!matchesStatus || !matchesCategory) {
            return;
          }

          const resolvedPrice =
            slot.customPrice ??
            (slot.reservedFor?.categoryId
              ? (categoriesById.get(slot.reservedFor.categoryId)?.basePrice ?? null)
              : null);

          rows.push({
            professionalId: professional.id,
            professionalName: professional.name,
            date,
            slotId: slot.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            label: slot.label ?? null,
            status: slot.status,
            categoryId: slot.reservedFor?.categoryId ?? null,
            categoryName: slot.reservedFor?.categoryName ?? null,
            contactId: slot.reservedFor?.contactId ?? null,
            contactName: slot.reservedFor?.contactName ?? null,
            contactPhone: slot.reservedFor?.contactPhone ?? null,
            reservedAt: slot.reservedAt ?? null,
            notes: slot.reservedFor?.notes ?? null,
            customPrice: slot.customPrice ?? null,
            resolvedPrice,
            paymentStatus: slot.payment?.status ?? null,
            paymentReference: slot.payment?.reference ?? null,
          });
        });
      });
    }

    rows.sort((left, right) => {
      const leftKey = `${left.date}T${left.startsAt}:00`;
      const rightKey = `${right.date}T${right.startsAt}:00`;
      return leftKey.localeCompare(rightKey);
    });

    const reservedStatuses = new Set(['PRE_RESERVED', 'RESERVED', 'COMPLETED', 'NO_SHOW']);

    return {
      generatedAt: new Date(),
      summary: {
        totalSlots: rows.length,
        reservedSlots: rows.filter((row) => reservedStatuses.has(row.status)).length,
        blockedSlots: rows.filter((row) => row.status === 'BLOCKED').length,
        availableSlots: rows.filter((row) => row.status === 'AVAILABLE').length,
        completedSlots: rows.filter((row) => row.status === 'COMPLETED').length,
        noShowSlots: rows.filter((row) => row.status === 'NO_SHOW').length,
        estimatedRevenue: rows.reduce(
          (total, row) => total + (row.resolvedPrice ?? 0),
          0,
        ),
      },
      rows,
    };
  }

  private buildDatesBetween(startDate: string, endDate: string): string[] {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException('Periodo invalido para o relatorio.');
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Periodo invalido para o relatorio.');
    }

    const diffInDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
    if (diffInDays > 90) {
      throw new BadRequestException('O relatorio aceita ate 90 dias por exportação.');
    }

    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
}
