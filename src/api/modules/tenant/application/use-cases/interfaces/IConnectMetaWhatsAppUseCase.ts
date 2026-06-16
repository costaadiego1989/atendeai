import { IUseCase } from '@shared/application/IUseCase';
import { ConfigureWhatsAppOutput } from './IConfigureWhatsAppUseCase';

export interface ConnectMetaWhatsAppInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  /** Short-lived authorization code returned by Meta Embedded Signup. */
  code: string;
  /** WhatsApp phone number id selected during Embedded Signup. */
  phoneNumberId: string;
  /** WhatsApp Business Account id selected during Embedded Signup. */
  wabaId: string;
  /** Business id owning the WABA (optional, stored for reference). */
  businessId?: string;
  /** Display phone number in E.164. */
  whatsappNumber: string;
  /** Optional webhook secret for x-hub-signature-256 verification. */
  webhookSecret?: string;
}

export type ConnectMetaWhatsAppOutput = ConfigureWhatsAppOutput;

export interface IConnectMetaWhatsAppUseCase extends IUseCase<
  ConnectMetaWhatsAppInput,
  ConnectMetaWhatsAppOutput
> {}

export const IConnectMetaWhatsAppUseCase = Symbol(
  'IConnectMetaWhatsAppUseCase',
);
