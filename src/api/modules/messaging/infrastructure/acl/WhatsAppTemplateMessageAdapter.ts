import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ProspectTemplateUnavailableError } from '@modules/prospecting/domain/errors/ProspectingErrors';
import {
  IWhatsAppTemplateSender,
  SendTemplateMessageParams,
} from '../../application/ports/IWhatsAppTemplateSender';

const META_TEMPLATE_ERROR_CODES = new Set([132000, 132001]);

@Injectable()
export class WhatsAppTemplateMessageAdapter implements IWhatsAppTemplateSender {
  constructor(private readonly configService: ConfigService) {}

  async send(
    params: SendTemplateMessageParams,
  ): Promise<{ messageId: string }> {
    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );

    if (!token || !phoneNumberId) {
      throw new ProspectTemplateUnavailableError(params.templateName);
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: params.to.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.languageCode },
            components: params.components,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return {
        messageId: response.data?.messages?.[0]?.id ?? `wa-${Date.now()}`,
      };
    } catch (error: any) {
      const errorCode = error.response?.data?.error?.code;
      if (META_TEMPLATE_ERROR_CODES.has(errorCode)) {
        throw new ProspectTemplateUnavailableError(params.templateName);
      }
      throw error;
    }
  }
}
