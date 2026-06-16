import { Inject, Injectable, Logger } from '@nestjs/common';
import { IConfigureWhatsAppUseCase } from './interfaces/IConfigureWhatsAppUseCase';
import {
  ConnectMetaWhatsAppInput,
  ConnectMetaWhatsAppOutput,
  IConnectMetaWhatsAppUseCase,
} from './interfaces/IConnectMetaWhatsAppUseCase';
import { MetaWhatsAppEmbeddedSignupService } from '../../infrastructure/services/MetaWhatsAppEmbeddedSignupService';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

@Injectable()
export class ConnectMetaWhatsAppUseCase implements IConnectMetaWhatsAppUseCase {
  private readonly logger = new Logger(ConnectMetaWhatsAppUseCase.name);

  constructor(
    private readonly embeddedSignupService: MetaWhatsAppEmbeddedSignupService,
    @Inject(IConfigureWhatsAppUseCase)
    private readonly configureWhatsAppUseCase: IConfigureWhatsAppUseCase,
  ) {}

  async execute(
    input: ConnectMetaWhatsAppInput,
  ): Promise<ConnectMetaWhatsAppOutput> {
    if (!input.phoneNumberId?.trim()) {
      throw new ValidationErrorException(
        'Meta WhatsApp phone number id is required',
      );
    }
    if (!input.wabaId?.trim()) {
      throw new ValidationErrorException('Meta WhatsApp WABA id is required');
    }

    const { accessToken } =
      await this.embeddedSignupService.exchangeCodeForAccessToken(
        input.code,
        input.tenantId,
      );

    try {
      await this.embeddedSignupService.subscribeAppToWaba(
        input.wabaId,
        accessToken,
        input.tenantId,
      );
    } catch (subscriptionError) {
      this.logger.warn(
        `connect_meta.waba_subscribe_failed: tenant=${input.tenantId} — credentials will still be saved. ` +
          'Inbound webhooks may not arrive until WABA subscription is restored. Retry by re-running the connect flow.',
      );
    }

    return this.configureWhatsAppUseCase.execute({
      tenantId: input.tenantId,
      requestingUserId: input.requestingUserId,
      requestingUserEmail: input.requestingUserEmail,
      provider: 'META_CLOUD',
      whatsappNumber: input.whatsappNumber,
      webhookSecret: input.webhookSecret,
      metaAccessToken: accessToken,
      metaPhoneNumberId: input.phoneNumberId,
      metaWabaId: input.wabaId,
      metaBusinessId: input.businessId,
      metaActivate: true,
    });
  }
}
