import { DeepgramSTTAdapter } from '../infrastructure/adapters/DeepgramSTTAdapter';
import { ConfigService } from '@nestjs/config';

describe('DeepgramSTTAdapter', () => {
  let adapter: DeepgramSTTAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'DEEPGRAM_API_KEY') return 'dg-test-key';
        return '';
      }),
    } as any;

    adapter = new DeepgramSTTAdapter(configService);
    jest.restoreAllMocks();
  });

  describe('transcribe', () => {
    it('should transcribe audio successfully', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: {
            channels: [
              {
                alternatives: [
                  {
                    transcript: 'Sim, quero pagar',
                    confidence: 0.95,
                    words: [
                      { word: 'sim', start: 0.0, end: 0.3 },
                      { word: 'quero', start: 0.4, end: 0.7 },
                      { word: 'pagar', start: 0.8, end: 1.2 },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      } as any);

      const result = await adapter.transcribe({
        audioBuffer: Buffer.from('fake-audio'),
        language: 'pt-BR',
        contentType: 'audio/webm',
      });

      expect(result.text).toBe('Sim, quero pagar');
      expect(result.confidence).toBe(0.95);
      expect(result.words).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('listen'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Token dg-test-key',
          }),
        }),
      );
    });

    it('should return empty text when no alternatives', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: { channels: [{ alternatives: [] }] },
        }),
      } as any);

      const result = await adapter.transcribe({
        audioBuffer: Buffer.from('silence'),
        contentType: 'audio/webm',
        language: 'pt-BR',
      });

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should throw on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      } as any);

      await expect(
        adapter.transcribe({
          audioBuffer: Buffer.from('audio'),
          contentType: 'audio/webm',
          language: 'pt-BR',
        }),
      ).rejects.toThrow('STT transcription failed: 403');
    });

    it('should use correct query params', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: { channels: [{ alternatives: [{ transcript: 'test', confidence: 0.9 }] }] },
        }),
      } as any);

      await adapter.transcribe({
        audioBuffer: Buffer.from('audio'),
        language: 'es',
        contentType: 'audio/mp3',
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(fetchCall).toContain('language=es');
      expect(fetchCall).toContain('model=nova-2');
      expect(fetchCall).toContain('punctuate=true');
    });
  });
});
