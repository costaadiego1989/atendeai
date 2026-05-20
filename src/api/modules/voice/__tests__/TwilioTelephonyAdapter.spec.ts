import { TwilioTelephonyAdapter } from '../infrastructure/adapters/TwilioTelephonyAdapter';
import { ConfigService } from '@nestjs/config';

describe('TwilioTelephonyAdapter', () => {
  let adapter: TwilioTelephonyAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC1234567890';
        if (key === 'TWILIO_AUTH_TOKEN') return 'auth-token-123';
        return '';
      }),
    } as any;

    adapter = new TwilioTelephonyAdapter(configService);
    jest.restoreAllMocks();
  });

  describe('makeCall', () => {
    it('should make a call successfully', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ sid: 'CA123456' }),
      } as any);

      const result = await adapter.makeCall({
        to: '+5511999999999',
        from: '+5511888888888',
        webhookUrl: 'https://api.atendeai.com/voice/webhook/twiml/call-1',
        statusCallbackUrl: 'https://api.atendeai.com/voice/webhook/status/call-1',
      });

      expect(result.success).toBe(true);
      expect(result.externalCallId).toBe('CA123456');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Calls.json'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return failure on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Invalid phone number'),
      } as any);

      const result = await adapter.makeCall({
        to: '+invalid',
        from: '+5511888888888',
        webhookUrl: 'https://api.atendeai.com/webhook',
        statusCallbackUrl: 'https://api.atendeai.com/status',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should return failure on network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await adapter.makeCall({
        to: '+5511999999999',
        from: '+5511888888888',
        webhookUrl: 'https://api.atendeai.com/webhook',
        statusCallbackUrl: 'https://api.atendeai.com/status',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });
  });

  describe('endCall', () => {
    it('should end a call', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);

      await adapter.endCall('CA123456');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('CA123456.json'),
        expect.objectContaining({
          method: 'POST',
          body: 'Status=completed',
        }),
      );
    });

    it('should not throw on error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(adapter.endCall('CA123456')).resolves.not.toThrow();
    });
  });

  describe('transferCall', () => {
    it('should transfer a call with TwiML', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);

      await adapter.transferCall('CA123456', '+5511777777777');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('CA123456.json'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should not throw on error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Timeout'));

      await expect(adapter.transferCall('CA123456', '+5511777777777')).resolves.not.toThrow();
    });
  });
});
