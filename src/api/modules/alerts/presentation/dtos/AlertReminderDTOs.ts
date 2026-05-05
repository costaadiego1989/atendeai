import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  AlertReminderFrequency,
  AlertReminderStatus,
} from '../../domain/types/AlertReminder';

export class CreateAlertReminderDTO {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsIn(['ONCE', 'DAILY'])
  frequency!: AlertReminderFrequency;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  timeOfDay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class UpdateAlertReminderDTO {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsIn(['ONCE', 'DAILY'])
  frequency?: AlertReminderFrequency;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  timeOfDay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'SENT'])
  status?: AlertReminderStatus;
}
