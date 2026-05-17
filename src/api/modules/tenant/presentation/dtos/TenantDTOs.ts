import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ToneType } from '../../domain/entities/AIConfig';
import { OperatingHours } from '../../domain/entities/Tenant';

export class CreateTenantDTO {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$|^\d{14}$/, {
    message: 'CNPJ must be in format XX.XXX.XXX/XXXX-XX or 14 digits',
  })
  cnpj: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$|^\d{11}$/, {
    message: 'CPF must be in format XXX.XXX.XXX-XX or 11 digits',
  })
  ownerCpf?: string;

  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @IsString()
  @IsNotEmpty()
  ownerPhone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  ownerPassword: string;

  @IsString()
  @IsOptional()
  plan?: string;

  @IsString()
  @IsOptional()
  businessType?: string;
}

export class ConfigureWhatsAppDTO {
  @IsString()
  @IsOptional()
  @IsIn(['BUBBLEWHATS', 'D360'])
  provider?: 'BUBBLEWHATS' | 'D360';

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

  @IsString()
  @IsOptional()
  bubbleWhatsId?: string;

  @IsString()
  @IsOptional()
  bubbleWhatsToken?: string;

  @IsString()
  @IsOptional()
  bubbleWhatsApiUrl?: string;

  @IsString()
  @IsOptional()
  d360ApiKey?: string;

  @IsString()
  @IsOptional()
  d360WebhookUrl?: string;

  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class ConfigureInstagramDTO {
  @IsString()
  @IsNotEmpty()
  instagramAccountId: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class RegisterTwilioWhatsAppSenderDTO {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  wabaId: string;

  @IsString()
  @IsOptional()
  @IsIn(['sms', 'voice'])
  verificationMethod?: 'sms' | 'voice';

  @IsString()
  @IsOptional()
  profileName?: string;

  @IsString()
  @IsOptional()
  about?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class VerifyTwilioWhatsAppSenderDTO {
  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class ConfigureAIDTO {
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsIn(['FRIENDLY', 'PROFESSIONAL', 'CASUAL'])
  tone: ToneType;

  @IsString()
  @IsOptional()
  language?: string;

  @IsNumber()
  @IsOptional()
  @Min(50)
  @Max(4000)
  maxTokensPerResponse?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;

  @IsString()
  @IsOptional()
  escalationMessage?: string;

  @IsOptional()
  businessRules?: string[];
}

export class UpdateBusinessDataDTO {
  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  @IsOptional()
  ownerBirthDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  services?: string;

  @IsString()
  @IsOptional()
  zipcode?: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  catalogUrl?: string;

  @IsOptional()
  @IsString({ each: true })
  catalogFiles?: string[];

  @IsOptional()
  operatingHours?: OperatingHours;
}

export class UpsertTenantPDFResumeDTO {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  checksum?: string;

  @IsString()
  @IsOptional()
  extractedText?: string;

  @IsOptional()
  @IsString({ each: true })
  summaries?: string[];

  @IsBoolean()
  @IsOptional()
  canSendIt?: boolean;
}

export class AddPromotionDTO {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;
}

export class UpdatePromotionDTO {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;
}

export class CreateTenantBranchDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$|^\d{14}$/, {
    message: 'CNPJ must be in format XX.XXX.XXX/XXXX-XX or 14 digits',
  })
  @IsOptional()
  cnpj?: string | null;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  instagramAccountId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['BUBBLEWHATS', 'TWILIO', 'D360'])
  whatsAppProvider?: 'BUBBLEWHATS' | 'TWILIO' | 'D360';

  @IsOptional()
  @IsObject()
  whatsAppCredentials?: Record<string, string>;

  @IsString()
  @IsOptional()
  whatsAppWebhookSecret?: string;

  @IsString()
  @IsOptional()
  zipcode?: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsOptional()
  @IsObject()
  operatingHours?: Record<
    string,
    { open: string; close: string; closed?: boolean }
  >;

  @IsOptional()
  isHeadquarters?: boolean;

  @IsOptional()
  active?: boolean;
}

export class UpdateTenantBranchDTO extends CreateTenantBranchDTO {}
