import { ElevenLabsTTSAdapter } from '../infrastructure/adapters/ElevenLabsTTSAdapter';
import { ConfigService } from '@nestjs/config';

describe('ElevenLabsTTSAdapter', () => {
  let adapter: ElevenLabsTTSAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ELEVENLABS_API_KEY') return 'sk-eleven-test-key';
        return '';
      }),
    } as any;

    adapter = new ElevenLabsTTSAdapter(configService);
    jest.restoreAllMocks();
  });

  describe('synthesize', () => {
    it('should synthesize text to audio successfully', async () => {
      const fakeAudio = new ArrayBuffer(16000); // ~1 second at 128kbps
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(fakeAudio),
      } as any);

      const result = await adapter.synthesize({
        text: 'Olá, como posso ajudar?',
        voiceId: 'voice-123',
      });

      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.durationMs).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('text-to-speech/voice-123'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'sk-eleven-test-key',
          }),
        }),
      );
    });

    it('should throw on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      } as any);

      await expect(
        adapter.synthesize({ text: 'Test', voiceId: 'voice-123' }),
      ).rejects.toThrow('TTS synthesis failed: 401');
    });
  });

  describe('listVoices', () => {
    it('should list available voices', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          voices: [
            { voice_id: 'v1', name: 'Camila', labels: { language: 'pt-BR' } },
            { voice_id: 'v2', name: 'Rachel', labels: { language: 'en-US' } },
          ],
        }),
      } as any);

      const voices = await adapter.listVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0]).toEqual({ id: 'v1', name: 'Camila', language: 'pt-BR' });
    });

    it('should filter voices by language', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          voices: [
            { voice_id: 'v1', name: 'Camila', labels: { language: 'pt-BR' } },
            { voice_id: 'v2', name: 'Rachel', labels: { language: 'en-US' } },
          ],
        }),
      } as any);

      const voices = await adapter.listVoices('pt-BR');

      expect(voices).toHaveLength(1);
      expect(voices[0].name).toBe('Camila');
    });

    it('should return empty array on API error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as any);

      const voices = await adapter.listVoices();
      expect(voices).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const voices = await adapter.listVoices();
      expect(voices).toEqual([]);
    });
  });
});
