import {
  AudioTranscriptionProvider,
  DocumentTextExtractor,
  ImageOcrProvider,
} from '../application/ports/IMediaUnderstandingProviders';
import { MediaUnderstandingService } from '../application/services/MediaUnderstandingService';

describe('MediaUnderstandingService', () => {
  let imageOcrProvider: jest.Mocked<ImageOcrProvider>;
  let audioTranscriptionProvider: jest.Mocked<AudioTranscriptionProvider>;
  let documentTextExtractor: jest.Mocked<DocumentTextExtractor>;
  let sut: MediaUnderstandingService;

  beforeEach(() => {
    imageOcrProvider = {
      extractTextFromImage: jest.fn(),
    };
    audioTranscriptionProvider = {
      transcribe: jest.fn(),
    };
    documentTextExtractor = {
      extractText: jest.fn(),
    };

    sut = new MediaUnderstandingService(
      imageOcrProvider,
      audioTranscriptionProvider,
      documentTextExtractor,
    );
  });

  it('should enrich an image message with OCR output for the AI prompt', async () => {
    imageOcrProvider.extractTextFromImage.mockResolvedValue({
      provider: 'vision-test',
      extractedText: 'Cardapio: cafe e bolo',
      confidence: 0.91,
    });

    const output = await sut.buildAiMessage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      type: 'IMAGE',
      url: 'https://media.test/cardapio.jpg',
      text: 'foto do cardapio',
      mimeType: 'image/jpeg',
    });

    expect(imageOcrProvider.extractTextFromImage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/cardapio.jpg',
      mimeType: 'image/jpeg',
      text: 'foto do cardapio',
    });
    expect(output).toContain('Cliente enviou imagem pelo WhatsApp.');
    expect(output).toContain('Mensagem: foto do cardapio');
    expect(output).toContain('Conteudo extraido: Cardapio: cafe e bolo');
    expect(output).toContain('Arquivo: https://media.test/cardapio.jpg');
  });

  it('should enrich an audio message with transcription for the AI prompt', async () => {
    audioTranscriptionProvider.transcribe.mockResolvedValue({
      provider: 'audio-test',
      extractedText: 'quero reservar uma mesa hoje',
      confidence: 0.88,
    });

    const output = await sut.buildAiMessage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      type: 'AUDIO',
      url: 'https://media.test/audio.ogg',
      mimeType: 'audio/ogg',
    });

    expect(audioTranscriptionProvider.transcribe).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/audio.ogg',
      mimeType: 'audio/ogg',
      text: undefined,
    });
    expect(output).toContain('Cliente enviou audio pelo WhatsApp.');
    expect(output).toContain('Transcricao: quero reservar uma mesa hoje');
  });

  it('should enrich a document message with extracted text for the AI prompt', async () => {
    documentTextExtractor.extractText.mockResolvedValue({
      provider: 'document-test',
      extractedText: 'Pedido numero 123 com endereco de entrega',
      confidence: 0.94,
    });

    const output = await sut.buildAiMessage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      type: 'DOCUMENT',
      url: 'https://media.test/pedido.pdf',
      text: 'pedido em pdf',
      mimeType: 'application/pdf',
    });

    expect(documentTextExtractor.extractText).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/pedido.pdf',
      mimeType: 'application/pdf',
      text: 'pedido em pdf',
    });
    expect(output).toContain('Cliente enviou documento pelo WhatsApp.');
    expect(output).toContain('Conteudo extraido: Pedido numero 123 com endereco de entrega');
  });

  it('should fall back to the media URL when the provider is unavailable', async () => {
    imageOcrProvider.extractTextFromImage.mockRejectedValue(new Error('ocr down'));

    const output = await sut.buildAiMessage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      type: 'IMAGE',
      url: 'https://media.test/image.jpg',
    });

    expect(output).toContain('Cliente enviou imagem pelo WhatsApp.');
    expect(output).toContain('Arquivo: https://media.test/image.jpg');
    expect(output).toContain('Nao foi possível extrair o conteudo da midia automaticamente.');
  });
});
