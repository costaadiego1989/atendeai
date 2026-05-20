import { WebChatWidgetAdapter } from '../infrastructure/acl/WebChatWidgetAdapter';

describe('WebChatWidgetAdapter', () => {
  let adapter: WebChatWidgetAdapter;

  beforeEach(() => {
    adapter = new WebChatWidgetAdapter();
    jest.restoreAllMocks();
  });

  describe('properties', () => {
    it('should have channel WEB_CHAT', () => {
      expect(adapter.channel).toBe('WEB_CHAT');
    });

    it('should have provider WIDGET', () => {
      expect(adapter.provider).toBe('WIDGET');
    });
  });

  describe('sendMessage', () => {
    it('should return success with a generated messageId', async () => {
      const mockUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as any);

      const result = await adapter.sendMessage(
        {} as any,
        'recipient-1',
        { type: 'text', text: 'Hello' } as any,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(mockUUID);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateSignature', () => {
    it('should always return true (widget uses public token auth)', () => {
      const result = adapter.validateSignature('any-signature', { data: 'test' }, {} as any);
      expect(result).toBe(true);
    });
  });

  describe('parseInboundMessage', () => {
    it('should parse a valid text message', () => {
      const body = {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        text: 'Hello there',
        type: 'text',
      };

      const result = adapter.parseInboundMessage(body);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('session-1');
      expect(result!.visitorId).toBe('visitor-1');
      expect(result!.content.text).toBe('Hello there');
      expect(result!.type).toBe('text');
      expect(result!.messageId).toBeDefined();
      expect(result!.timestamp).toBeDefined();
    });

    it('should parse an image message', () => {
      const body = {
        sessionId: 'session-1',
        visitorId: 'visitor-1',
        type: 'image',
        url: 'https://cdn.example.com/image.png',
      };

      const result = adapter.parseInboundMessage(body);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('image');
      expect(result!.content.url).toBe('https://cdn.example.com/image.png');
    });

    it('should return null when sessionId is missing', () => {
      const body = { visitorId: 'v1', text: 'hi' };
      const result = adapter.parseInboundMessage(body);
      expect(result).toBeNull();
    });

    it('should return null when visitorId is missing', () => {
      const body = { sessionId: 's1', text: 'hi' };
      const result = adapter.parseInboundMessage(body);
      expect(result).toBeNull();
    });

    it('should return null for text type without text content', () => {
      const body = { sessionId: 's1', visitorId: 'v1', type: 'text' };
      const result = adapter.parseInboundMessage(body);
      expect(result).toBeNull();
    });

    it('should default type to text when not specified', () => {
      const body = { sessionId: 's1', visitorId: 'v1', text: 'hello' };
      const result = adapter.parseInboundMessage(body);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('text');
    });
  });
});
