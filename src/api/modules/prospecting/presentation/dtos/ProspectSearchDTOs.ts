import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateProspectSearchDTO {
  @IsString()
  @IsNotEmpty()
  businessTypeQuery: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsIn(['GOOGLE_PLACES', 'GOOGLE_ADS_AUDIENCE'])
  @IsOptional()
  source?: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  maxResults?: number;
}

export class ImportProspectSearchResultsDTO {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  resultIds?: string[];
}

export class ProspectSelectedSearchResultsDTO {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  resultIds: string[];

  @IsString()
  @IsNotEmpty()
  messageTemplate: string;

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsIn(['WHATSAPP', 'INSTAGRAM'])
  @IsOptional()
  channel?: 'WHATSAPP' | 'INSTAGRAM';

  @IsString()
  @IsIn(['ASSISTED_QUEUE', 'DIRECT_FIRST_MESSAGE'])
  @IsOptional()
  dispatchMode?: 'ASSISTED_QUEUE' | 'DIRECT_FIRST_MESSAGE';
}

export class CreateProspectAdsInsightQueryDTO {
  @IsString()
  @IsNotEmpty()
  segment!: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  ageRange?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  interest?: string;
}

export class SyncProspectAdsLeadsDTO {
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class ImportProspectAdsLeadsDTO {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  leadIds!: string[];
}

export class ProspectAdsLeadsDTO {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  leadIds!: string[];

  @IsString()
  @IsNotEmpty()
  messageTemplate!: string;

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsIn(['WHATSAPP', 'INSTAGRAM'])
  @IsOptional()
  channel?: 'WHATSAPP' | 'INSTAGRAM';
}

export class SelectGoogleAdsAccountDTO {
  @IsString()
  @IsNotEmpty()
  customerId!: string;
}
