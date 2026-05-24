export const WHATSAPP_TEMPLATE_SENDER = 'WHATSAPP_TEMPLATE_SENDER';

export interface TemplateComponent {
  type: 'body';
  parameters: Array<{ type: 'text'; text: string }>;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
}

export interface IWhatsAppTemplateSender {
  send(params: SendTemplateMessageParams): Promise<{ messageId: string }>;
}
