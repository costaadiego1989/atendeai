import { Type } from 'class-transformer';
import {
  IsEnum,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SchedulingCategoryUnit } from '../../domain/ports/ISchedulingStore';
import {
  SCHEDULING_BILLING_TYPES,
  SCHEDULING_RECURRENCE_FREQUENCIES,
  SCHEDULING_SLOT_ACTIONS,
  SCHEDULING_SLOT_STATUSES,
  SchedulingBillingType,
  SchedulingRecurrenceFrequency,
  SchedulingSlotAction,
  SchedulingSlotStatus,
} from '../../domain/types/SchedulingEnums';

const SCHEDULING_CATEGORY_UNITS = {
  PER_MINUTE: 'PER_MINUTE',
  PER_SESSION: 'PER_SESSION',
  PER_CONSULTATION: 'PER_CONSULTATION',
} as const;

export class CreateSchedulingProfessionalDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class CreateSchedulingCategoryDTO {
  @IsString()
  name!: string;

  @IsEnum(SCHEDULING_CATEGORY_UNITS)
  unit!: SchedulingCategoryUnit;

  @ValidateIf(
    (object: CreateSchedulingCategoryDTO) => object.unit === 'PER_MINUTE',
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice?: number;
}

export class AvailabilitySlotDTO {
  @Matches(/^\d{2}:\d{2}$/)
  startsAt!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endsAt!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  customPrice?: number;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

export class SetProfessionalAvailabilityDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDTO)
  slots!: AvailabilitySlotDTO[];
}

export class ReserveProfessionalSlotDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsString()
  slotId!: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(SCHEDULING_RECURRENCE_FREQUENCIES)
  recurrencePeriod?: SchedulingRecurrenceFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenceInterval?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  recurrenceOccurrences?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentTimeoutHours?: number;
}

export class UpdateAvailabilitySlotDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsEnum(SCHEDULING_SLOT_ACTIONS)
  action!: SchedulingSlotAction;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RescheduleSchedulingReservationDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sourceDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetDate!: string;

  @IsString()
  targetSlotId!: string;
}

export class GenerateSchedulingPaymentLinkDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsEnum(SCHEDULING_BILLING_TYPES)
  billingType?: SchedulingBillingType;
}

export class GenerateSchedulingReportDTO {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  professionalIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(SCHEDULING_SLOT_STATUSES, { each: true })
  statuses?: SchedulingSlotStatus[];
}

export class AssignProfessionalCategoriesDTO {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];
}

export class CreateSchedulingRecurrenceDTO {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOccurrences?: number;

  @Matches(/^\d{2}:\d{2}$/)
  startsAt!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endsAt!: string;

  @IsEnum(SCHEDULING_RECURRENCE_FREQUENCIES)
  frequency!: SchedulingRecurrenceFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  interval?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentTimeoutHours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelSchedulingRecurrenceDTO {
  @IsOptional()
  @IsString()
  reason?: string;
}
