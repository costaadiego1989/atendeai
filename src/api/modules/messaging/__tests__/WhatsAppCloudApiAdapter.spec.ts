import axios from 'axios';
import * as crypto from 'crypto';
import { WhatsAppCloudApiAdapter, META_WHATSAPP_RAW_BODY_HEADER } from '../infrastructure/acl/WhatsAppCloudApiAdapter';
import { MessagingProviderConfig } from '../domain/ports/IMessagingGateway';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const makeConfig = (overrides: Partial<MessagingProviderConfig> = {}): MessagingProviderConfig => ({
  channel: 'WHATSAPP',
  provider: 'META_CLOUD',
  credentials: {
    accessToken: 'test-token',
    phoneNumberId: 'phone-id-123',
  },
  status: 'ACTIVE',
  ...overrides,
});

const makeConfigService = (version = 'v21.0', appSecret = 'app-secret') => ({
  get: jest.fn((key: string) => {
    if (key === 'META_GRAPH_API_VERSION') return version;
    if (key === 'META_APP_SECRET') return appSecret;
    return undefined;
  }),
});

describe('WhatsAppCloudApiAdapter', () => {
  let adapter: WhatsAppCloudApiAdapter;
  let configService: ReturnType<typeof makeConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = makeConfigService();
    adapter = new WhatsAppCloudApiAdapter(configService as any);
  });

  // ─── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('sends text message with correct URL, payload, headers, and timeout', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-id-1' }] },
      });

      const result = await adapter.sendMessage(makeConfig(), '55 11 99999-9999', {
        type: 'text',
        text: 'Olá!',
      });

      expect(result).toEqual({ success: true, messageId: 'msg-id-1' });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/phone-id-123/messages',
        {
          messaging_product: 'whatsapp',
          to: '5511999999999',
          type: 'text',
          text: { body: 'Olá!' },
        },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
          timeout: 10000,
        }),
      );
    });

    it('sends template message with correct payload shape', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-tpl-1' }] },
      });

      const result = await adapter.sendMessage(makeConfig(), '5511999999999', {
        type: 'template',
        text: '',
        template: { name: 'hello_world', languageCode: 'pt_BR', components: [] },
      } as any);

      expect(result).toEqual({ success: true, messageId: 'msg-tpl-1' });
      const payload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(payload).toMatchObject({
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'pt_BR' },
          components: [],
        },
      });
    });

    it('returns failure without calling axios when accessToken is missing', async () => {
      mockedAxios.post = jest.fn();
      const config = makeConfig({ credentials: { phoneNumberId: 'phone-id-123' } });

      const result = await adapter.sendMessage(config, '5511999999999', { type: 'text', text: 'hi' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('returns failure without calling axios when phoneNumberId is missing', async () => {
      mockedAxios.post = jest.fn();
      const config = makeConfig({ credentials: { accessToken: 'tok' } });

      const result = await adapter.sendMessage(config, '5511999999999', { type: 'text', text: 'hi' });

      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('returns failure with Graph error message when axios rejects', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue({
        response: { data: { error: { message: 'Graph API error' } } },
        message: 'Request failed',
      });

      const result = await adapter.sendMessage(makeConfig(), '5511999999999', { type: 'text', text: 'hi' });

      expect(result).toEqual({ success: false, error: 'Graph API error' });
    });

    it('uses META_GRAPH_API_VERSION from configService in URL', async () => {
      configService = makeConfigService('v20.0');
      adapter = new WhatsAppCloudApiAdapter(configService as any);
      mockedAxios.post = jest.fn().mockResolvedValue({ data: { messages: [{ id: 'x' }] } });

      await adapter.sendMessage(makeConfig(), '5511999999999', { type: 'text', text: 'hi' });

      const url = (mockedAxios.post as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/v20.0/');
    });
  });

  // ─── validateSignature ─────────────────────────────────────────────────────

  describe('validateSignature', () => {
    const rawBody = '{"entry":[]}';
    const appSecret = 'app-secret';

    const buildSignature = (body: string, secret: string) => {
      return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    };

    const makeHeaders = (body: string) => ({
      [META_WHATSAPP_RAW_BODY_HEADER]: body,
    });

    it('returns true for valid HMAC-SHA256 signature', () => {
      const sig = buildSignature(rawBody, appSecret);
      const result = adapter.validateSignature(sig, {}, makeConfig(), {
        headers: makeHeaders(rawBody),
      });
      expect(result).toBe(true);
    });

    it('returns false for invalid signature', () => {
      const result = adapter.validateSignature('sha256=wronghex', {}, makeConfig(), {
        headers: makeHeaders(rawBody),
      });
      expect(result).toBe(false);
    });

    it('returns false when raw body header is missing', () => {
      const sig = buildSignature(rawBody, appSecret);
      const result = adapter.validateSignature(sig, {}, makeConfig(), {
        headers: {},
      });
      expect(result).toBe(false);
    });

    it('returns false when appSecret is empty', () => {
      configService = makeConfigService('v21.0', '');
      adapter = new WhatsAppCloudApiAdapter(configService as any);
      const sig = buildSignature(rawBody, appSecret);
      const result = adapter.validateSignature(sig, {}, makeConfig({ webhookSecret: '' }), {
        headers: makeHeaders(rawBody),
      });
      expect(result).toBe(false);
    });

    it('normalizes signature without sha256= prefix', () => {
      const hex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const result = adapter.validateSignature(hex, {}, makeConfig(), {
        headers: makeHeaders(rawBody),
      });
      expect(result).toBe(true);
    });

    it('uses webhookSecret from config over META_APP_SECRET', () => {
      const customSecret = 'custom-webhook-secret';
      const sig = buildSignature(rawBody, customSecret);
      const result = adapter.validateSignature(sig, {}, makeConfig({ webhookSecret: customSecret }), {
        headers: makeHeaders(rawBody),
      });
      expect(result).toBe(true);
    });
  });

  // ─── parseInboundMessage ───────────────────────────────────────────────────

  describe('parseInboundMessage', () => {
    const makeBody = (value: object) => ({
      entry: [{ changes: [{ value }] }],
    });

    it('parses text message', () => {
      const body = makeBody({
        metadata: { display_phone_number: '551199999', phone_number_id: 'pid-1' },
        messages: [{
          id: 'msg-1',
          from: '5521988887777',
          type: 'text',
          timestamp: '1700000000',
          text: { body: 'Hello!' },
        }],
      });

      const result = adapter.parseInboundMessage(body);

      expect(result).toMatchObject({
        messageId: 'msg-1',
        from: '5521988887777',
        deviceId: 'pid-1',
        type: 'text',
        content: { text: 'Hello!' },
      });
      expect(result?.timestamp).toBeTruthy();
    });

    it('parses status update', () => {
      const body = makeBody({
        metadata: { display_phone_number: '551199999', phone_number_id: 'pid-1' },
        statuses: [{
          id: 'msg-delivered',
          status: 'delivered',
          recipient_id: '5521988887777',
          timestamp: '1700000001',
        }],
      });

      const result = adapter.parseInboundMessage(body);

      expect(result).toMatchObject({
        messageId: 'msg-delivered',
        from: '5521988887777',
        type: 'status',
        content: { text: 'delivered' },
      });
    });

    it('parses image message', () => {
      const body = makeBody({
        metadata: { phone_number_id: 'pid-1' },
        messages: [{
          id: 'img-1',
          from: '5521988887777',
          type: 'image',
          timestamp: '1700000002',
          image: { id: 'media-id-abc', mime_type: 'image/jpeg' },
        }],
      });

      const result = adapter.parseInboundMessage(body);

      expect(result).toMatchObject({
        type: 'image',
        content: { url: 'media-id-abc', mimeType: 'image/jpeg' },
      });
    });

    it('returns null for body without entry', () => {
      expect(adapter.parseInboundMessage({})).toBeNull();
    });

    it('returns null when entry has no messages or statuses', () => {
      const body = makeBody({ metadata: { phone_number_id: 'pid-1' } });
      expect(adapter.parseInboundMessage(body)).toBeNull();
    });
  });
});
