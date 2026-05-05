import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsIn,
} from 'class-validator';

export class CreateContactDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateContactDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  document?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateContactStageDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn(['LEAD', 'PROSPECT', 'OPPORTUNITY', 'CUSTOMER', 'INACTIVE'])
  stage: string;
}

export class ImportContactsListDTO {
  @IsString()
  @IsNotEmpty()
  rawText: string;

  @IsOptional()
  @IsString()
  @IsIn(['LEAD', 'PROSPECT', 'OPPORTUNITY', 'CUSTOMER', 'INACTIVE'])
  defaultStage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultTags?: string[];
}

export class GenerateContactsReportDTO {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['LEAD', 'PROSPECT', 'OPPORTUNITY', 'CUSTOMER', 'INACTIVE'], { each: true })
  stages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['MESSAGING', 'RECOVERY', 'PAYMENT', 'SCHEDULING'], { each: true })
  timelineTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['WHATSAPP', 'INSTAGRAM', 'CRM'], { each: true })
  channels?: string[];

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
