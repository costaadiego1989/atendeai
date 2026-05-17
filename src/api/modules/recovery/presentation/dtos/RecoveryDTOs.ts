import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CreateRecoveryCaseDTO {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  debtorName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  debtorCompanyName?: string;

  @IsOptional()
  @IsString()
  debtorDocument?: string;

  @IsOptional()
  @IsString()
  chargeType?: string;

  @IsOptional()
  @IsString()
  chargeTitle?: string;

  @IsOptional()
  @IsString()
  chargeDescription?: string;

  @IsOptional()
  @IsString()
  referencePeriod?: string;

  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @IsOptional()
  @IsString()
  relatedEntityLabel?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : String(value)))
  @Matches(/^\d+(\.\d{1,2})?$/)
  amountDue?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedTags?: string[];
}

export class UpdateRecoveryCaseStatusDTO {
  @IsString()
  status!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  nextActionAt?: string;
}

export class TriggerRecoveryOutreachDTO {
  @IsOptional()
  @IsString()
  messageText?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  previewOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  generateWithAI?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  followPlaybook?: boolean;
}

export class GenerateRecoveryPaymentLinkDTO {
  @IsOptional()
  @IsIn(['UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX'])
  billingType?: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
}

export class ScheduleRecoveryRecurringChargeDTO {
  @IsOptional()
  @IsIn(['UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX'])
  billingType?: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(365)
  intervalDays!: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(120)
  maxOccurrences?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  firstRunAt?: string;

  @IsOptional()
  @IsString()
  messageTemplate?: string;
}

export class CancelRecoveryRecurringChargeDTO {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RegenerateRecoveryGuidanceDTO {
  @IsOptional()
  @IsString()
  customerMessage?: string;
}

export class GenerateRecoveryReportDTO {
  @IsOptional()
  @IsArray()
  @IsEnum(
    {
      READY_TO_CONTACT: 'READY_TO_CONTACT',
      CONTACTED: 'CONTACTED',
      NEGOTIATING: 'NEGOTIATING',
      PROMISE_TO_PAY: 'PROMISE_TO_PAY',
      PAID: 'PAID',
      NO_RESPONSE: 'NO_RESPONSE',
      INVALID_CONTACT: 'INVALID_CONTACT',
      STOPPED: 'STOPPED',
    },
    { each: true },
  )
  statuses?: Array<
    | 'READY_TO_CONTACT'
    | 'CONTACTED'
    | 'NEGOTIATING'
    | 'PROMISE_TO_PAY'
    | 'PAID'
    | 'NO_RESPONSE'
    | 'INVALID_CONTACT'
    | 'STOPPED'
  >;

  @IsOptional()
  @IsArray()
  @IsEnum(
    {
      CRM: 'CRM',
      MANUAL: 'MANUAL',
      IMPORT: 'IMPORT',
    },
    { each: true },
  )
  sources?: Array<'CRM' | 'MANUAL' | 'IMPORT'>;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T/)
  dateTo?: string;
}

export class CreateRecoveryPlaybookPhaseDTO {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsIn(['WHATSAPP'])
  channel?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(0)
  minDelayHoursSincePrevious?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(0)
  minDaysOverdue?: number;

  @IsIn(['AI', 'TEMPLATE'])
  mode!: 'AI' | 'TEMPLATE';

  @IsOptional()
  @IsString()
  templateBody?: string;
}

export class CreateRecoveryPlaybookDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecoveryPlaybookPhaseDTO)
  phases!: CreateRecoveryPlaybookPhaseDTO[];
}
