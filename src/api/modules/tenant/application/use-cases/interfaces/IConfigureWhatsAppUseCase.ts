import { IUseCase } from '@shared/application/IUseCase';

export interface ConfigureWhatsAppInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  provider?: 'BUBBLEWHATS' | 'D360' | 'META_CLOUD';
  whatsappNumber: string;
  bubbleWhatsId?: string;
  bubbleWhatsToken?: string;
  bubbleWhatsApiUrl?: string;
  d360ApiKey?: string;
  d360WebhookUrl?: string;
  webhookSecret?: string;
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaWabaId?: string;
  metaBusinessId?: string;
  metaActivate?: boolean;
}

export interface ConfigureWhatsAppOutput {
  id: string;
  provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360' | 'META_CLOUD';
  whatsappNumber: string;
  status: string;
  configuredAt: Date;
}

export interface IConfigureWhatsAppUseCase extends IUseCase<
  ConfigureWhatsAppInput,
  ConfigureWhatsAppOutput
> {}
export const IConfigureWhatsAppUseCase = Symbol('IConfigureWhatsAppUseCase');
