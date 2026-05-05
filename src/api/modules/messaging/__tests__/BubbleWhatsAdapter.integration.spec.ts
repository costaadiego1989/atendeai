import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { BubbleWhatsAdapter } from '../infrastructure/acl/BubbleWhatsAdapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

describe('BubbleWhatsAdapter', () => {
  let adapter: BubbleWhatsAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'BUBBLEWHATS_API_URL') {
          return 'https://bubblewhats.test';
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new BubbleWhatsAdapter(configService);
  });

  it('should validate webhook signatures with HMAC SHA-256', () => {
    const body = {
      event: 'message.received',
      data: {
        messageId: 'msg-1',
      },
    };
    const signature = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    const config = {
      channel: 'WHATSAPP' as const,
      provider: 'BUBBLEWHATS' as const,
      credentials: {},
      webhookSecret: 'secret',
      status: 'ACTIVE',
    };

    expect(adapter.validateSignature(signature, body, config)).toBe(true);
    expect(adapter.validateSignature('wrong', body, config)).toBe(false);
    expect(
      adapter.validateSignature(signature, body, {
        ...config,
        webhookSecret: '',
      }),
    ).toBe(true);
  });

  it('should parse inbound message payloads from BubbleWhats', () => {
    const result = adapter.parseInboundMessage({
      event: 'message.received',
      data: {
        messageId: 'msg-1',
        from: '5511999998888',
        to: '5511911112222',
        type: 'text',
        content: {
          text: 'Oi, tudo bem?',
        },
        timestamp: '2026-01-01T10:00:00.000Z',
      },
    });

    expect(result).toEqual({
      messageId: 'msg-1',
      from: '5511999998888',
      to: '5511911112222',
      type: 'text',
      content: {
        text: 'Oi, tudo bem?',
      },
      timestamp: '2026-01-01T10:00:00.000Z',
    });
  });

  it('should ignore unsupported webhook events', () => {
    expect(
      adapter.parseInboundMessage({
        event: 'status.updated',
        data: {},
      }),
    ).toBeNull();
  });

  it('should parse native BubbleWhats payloads with deviceID and remoteJid', () => {
    const result = adapter.parseInboundMessage({
      deviceID: '7071',
      messages: [
        {
          key: {
            remoteJid: '5511999997777@s.whatsapp.net',
            id: 'native-msg-1',
            fromMe: false,
          },
          message: {
            conversation: 'Oi pelo formato nativo',
          },
          messageTimestamp: 1710000000,
        },
      ],
    });

    expect(result).toEqual({
      messageId: 'native-msg-1',
      from: '5511999997777',
      to: undefined,
      deviceId: '7071',
      type: 'text',
      content: {
        text: 'Oi pelo formato nativo',
      },
      timestamp: new Date(1710000000 * 1000).toISOString(),
    });
  });

  it('should parse simple array payloads from BubbleWhats', () => {
    const result = adapter.parseInboundMessage({
      deviceID: '7071',
      toNumber: '5521993001883',
      messages: [
        {
          from: '5511999997777',
          body: 'Oi pelo array simples',
          timestamp: 1710000000,
        },
      ],
    });

    expect(result).toEqual({
      messageId: expect.stringContaining('bw-array-'),
      from: '5511999997777',
      to: '5521993001883',
      deviceId: '7071',
      type: 'text',
      content: {
        text: 'Oi pelo array simples',
      },
      timestamp: new Date(1710000000 * 1000).toISOString(),
    });
  });

  it('should parse messageContext payloads and ignore fromMe noise without alias', () => {
    expect(
      adapter.parseInboundMessage({
        deviceID: '7071',
        from: '5511999997777',
        body: 'Eco do sistema',
        messageContext: {
          key: { fromMe: true },
        },
      }),
    ).toBeNull();

    const result = adapter.parseInboundMessage({
      deviceID: '7071',
      fromNumber: '5511999998888',
      toNumber: '5521993001883',
      messageContext: {
        message: {
          extendedTextMessage: {
            text: 'Oi pelo messageContext',
          },
        },
        key: { fromMe: false },
      },
    });

    expect(result).toEqual({
      messageId: expect.stringContaining('bw-context-'),
      from: '5511999998888',
      to: '5521993001883',
      deviceId: '7071',
      type: 'text',
      content: {
        text: 'Oi pelo messageContext',
      },
      timestamp: expect.any(String),
    });
  });

  it('should send outbound messages to the BubbleWhats API', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        messageId: 'bw-msg-1',
      },
    });

    const result = await adapter.sendMessage({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        token: 'api-key',
      },
      status: 'ACTIVE',
    }, '5511999998888', {
      type: 'TEXT',
      text: 'Mensagem outbound',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://bubblewhats.test/send-message',
      {
        jid: '5511999998888',
        message: 'Mensagem outbound',
      },
      {
        headers: {
          Authorization: 'api-key',
          'Content-Type': 'application/json',
        },
      },
    );
    expect(result).toEqual({
      success: true,
      messageId: 'bw-msg-1',
    });
  });

  it('should return a normalized failure result when the provider errors', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      message: 'Request failed',
      response: {
        data: {
          message: 'Provider unavailable',
        },
      },
    });

    const result = await adapter.sendMessage({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        token: 'api-key',
      },
      status: 'ACTIVE',
    }, '5511999998888', {
      type: 'TEXT',
      text: 'Mensagem outbound',
    });

    expect(result).toEqual({
      success: false,
      error: 'Provider unavailable',
    });
  });

  it('should normalize phone numbers before sending outbound messages', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        messageId: 'bw-msg-2',
      },
    });

    await adapter.sendMessage({
      channel: 'WHATSAPP',
      provider: 'BUBBLEWHATS',
      credentials: {
        token: 'api-key',
      },
      status: 'ACTIVE',
    }, '(21) 99300-1883', {
      type: 'TEXT',
      text: 'Mensagem outbound',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://bubblewhats.test/send-message',
      {
        jid: '5521993001883',
        message: 'Mensagem outbound',
      },
      expect.any(Object),
    );
  });
});
