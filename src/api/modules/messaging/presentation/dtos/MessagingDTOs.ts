import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class SendMessageDTO {
  @IsObject()
  @IsNotEmpty()
  content: {
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    url?: string;
  };
}

export class UpdateConversationStatusDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ACTIVE', 'PENDING_HUMAN', 'ARCHIVED'])
  status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED';
}

export class EnsureConversationForContactDTO {
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['WHATSAPP', 'INSTAGRAM'])
  channel: 'WHATSAPP' | 'INSTAGRAM';
}

export class MarkConversationSaleAttributionDTO {
  @IsOptional()
  @IsUUID()
  attributedUserId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saleAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateConversationSaleAttributionDTO {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(0)
  saleAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
