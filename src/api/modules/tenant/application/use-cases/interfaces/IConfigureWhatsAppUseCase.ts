import { IUseCase } from '@shared/application/IUseCase';

export interface ConfigureWhatsAppInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  provider?: 'BUBBLEWHATS' | 'D360';
  whatsappNumber: string;
  bubbleWhatsId?: string;
  bubbleWhatsToken?: string;
  bubbleWhatsApiUrl?: string;
  d360ApiKey?: string;
  d360WebhookUrl?: string;
  webhookSecret?: string;
}

export interface ConfigureWhatsAppOutput {
  id: string;
  provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
  whatsappNumber: string;
  status: string;
  configuredAt: Date;
}

export interface IConfigureWhatsAppUseCase extends IUseCase<
  ConfigureWhatsAppInput,
  ConfigureWhatsAppOutput
> {}
export const IConfigureWhatsAppUseCase = Symbol('IConfigureWhatsAppUseCase');
