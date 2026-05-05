import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProspectCampaignDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsString()
  @IsIn(['REENGAGEMENT', 'CONTACT_LIST'])
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';

  @IsString()
  @IsIn(['WHATSAPP', 'INSTAGRAM'])
  channel: 'WHATSAPP' | 'INSTAGRAM';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetContactIds?: string[];

  @IsString()
  @IsOptional()
  messageTemplate?: string;

  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  dailyLimit?: number;
}

class SuggestProspectMessageContactDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  stage?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class SuggestProspectCampaignMessageDTO {
  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsString()
  @IsIn(['REENGAGEMENT', 'CONTACT_LIST'])
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';

  @IsArray()
  @IsString({ each: true })
  channels: Array<'WHATSAPP' | 'INSTAGRAM'>;

  @IsString()
  @IsOptional()
  stageFilter?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';

  @IsString()
  @IsOptional()
  searchTerm?: string;

  @IsInt()
  @Min(1)
  selectedCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestProspectMessageContactDTO)
  @IsOptional()
  selectedContacts?: SuggestProspectMessageContactDTO[];
}
