import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSalesPaymentLinkDTO {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.01)
  value!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(['UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX'])
  billingType?: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsIn(['MANUAL', 'AI'])
  source?: 'MANUAL' | 'AI';

  @IsOptional()
  recurring?: boolean;

  @IsOptional()
  @IsIn(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
  recurrenceFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsOptional()
  @IsDateString()
  recurrenceStartDate?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional()
  @IsUUID()
  catalogItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  catalogItemSku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  catalogItemName?: string;
}

export class CreateSalesSplitChargeDTO {
  @IsString()
  contactId!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  customerDocument?: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.01)
  value!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(['BOLETO', 'CREDIT_CARD', 'PIX'])
  billingType?: 'BOLETO' | 'CREDIT_CARD' | 'PIX';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  sendViaWhatsApp?: boolean;

  @IsOptional()
  recurring?: boolean;

  @IsOptional()
  @IsIn(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
  recurrenceFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsOptional()
  @IsDateString()
  recurrenceStartDate?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;
}

export class SuggestSalesPaymentLinkWithAIDTO {
  @IsString()
  prompt!: string;
}
