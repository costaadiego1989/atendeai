import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { WhatsAppTemplateMessageAdapter } from '../infrastructure/acl/WhatsAppTemplateMessageAdapter';
import { ProspectTemplateUnavailableError } from '@modules/prospecting/domain/errors/ProspectingErrors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeAdapter(token = 'test-token', phoneNumberId = 'phone-123') {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_ACCESS_TOKEN') return token;
      if (key === 'WHATSAPP_PHONE_NUMBER_ID') return phoneNumberId;
      return undefined;
    }),
  } as unknown as ConfigService;
  return new WhatsAppTemplateMessageAdapter(configService);
}

const baseParams = {
  to: '11999998888',
  templateName: 'atendeai_outbound_v1',
  languageCode: 'pt_BR',
  components: [
    { type: 'body' as const, parameters: [{ type: 'text' as const, text: 'Maria' }] },
  ],
};

describe('WhatsAppTemplateMessageAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('sends template and returns messageId', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { messages: [{ id: 'wamid.abc123' }] },
    });

    const adapter = makeAdapter();
    const result = await adapter.send(baseParams);

    expect(result.messageId).toBe('wamid.abc123');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/phone-123/messages',
      expect.objectContaining({
        messaging_product: 'whatsapp',
        to: '11999998888',
        type: 'template',
        template: expect.objectContaining({ name: 'atendeai_outbound_v1' }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('strips non-digit characters from phone number', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { messages: [{ id: 'wamid.xyz' }] },
    });

    const adapter = makeAdapter();
    await adapter.send({ ...baseParams, to: '+55 (11) 99999-8888' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ to: '5511999998888' }),
      expect.any(Object),
    );
  });

  it('throws ProspectTemplateUnavailableError when Meta returns template-not-found (132001)', async () => {
    mockedAxios.post = jest.fn().mockRejectedValue({
      response: { data: { error: { code: 132001, message: 'Template not found' } } },
    });

    const adapter = makeAdapter();
    await expect(adapter.send(baseParams)).rejects.toThrow(ProspectTemplateUnavailableError);
  });

  it('throws ProspectTemplateUnavailableError when Meta returns 132000', async () => {
    mockedAxios.post = jest.fn().mockRejectedValue({
      response: { data: { error: { code: 132000, message: 'Template does not exist' } } },
    });

    const adapter = makeAdapter();
    await expect(adapter.send(baseParams)).rejects.toThrow(ProspectTemplateUnavailableError);
  });

  it('re-throws non-template errors unchanged', async () => {
    const networkError = new Error('Network error');
    mockedAxios.post = jest.fn().mockRejectedValue(networkError);

    const adapter = makeAdapter();
    await expect(adapter.send(baseParams)).rejects.toThrow('Network error');
    await expect(adapter.send(baseParams)).rejects.not.toThrow(ProspectTemplateUnavailableError);
  });

  it('throws ProspectTemplateUnavailableError when credentials are missing', async () => {
    const adapter = makeAdapter('', '');
    await expect(adapter.send(baseParams)).rejects.toThrow(ProspectTemplateUnavailableError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
