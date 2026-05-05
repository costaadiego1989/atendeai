import { IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class GenerateProspectSearchReportDTO {
  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsIn(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], { each: true })
  @IsOptional()
  statuses?: Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>;

  @IsArray()
  @IsIn(['GOOGLE_PLACES', 'GOOGLE_ADS_AUDIENCE'], { each: true })
  @IsOptional()
  sources?: Array<'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE'>;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}

export class GenerateProspectCampaignReportDTO {
  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'], { each: true })
  @IsOptional()
  statuses?: Array<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'>;

  @IsArray()
  @IsIn(['WHATSAPP', 'INSTAGRAM'], { each: true })
  @IsOptional()
  channels?: Array<'WHATSAPP' | 'INSTAGRAM'>;

  @IsArray()
  @IsIn(['REENGAGEMENT', 'CONTACT_LIST'], { each: true })
  @IsOptional()
  audienceTypes?: Array<'REENGAGEMENT' | 'CONTACT_LIST'>;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
