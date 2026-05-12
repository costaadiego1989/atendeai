import { ConversationIntelligenceService } from '../application/services/ConversationIntelligenceService';
import { IConversationIntelligenceRepository } from '../domain/repositories/IConversationIntelligenceRepository';

describe('ConversationIntelligenceService', () => {
  let sut: ConversationIntelligenceService;
  let intelligenceRepository: jest.Mocked<Pick<IConversationIntelligenceRepository, 'save' | 'findByConversationIds'>>;

  beforeEach(() => {
    intelligenceRepository = {
      save: jest.fn(),
      findByConversationIds: jest.fn(),
    };

    sut = new ConversationIntelligenceService(intelligenceRepository as any);
  });

  it('should store intelligence data with detected tags, interests, and sentiment', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Qual o preço do produto?',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        sentiment: 'NEUTRAL',
        tags: expect.arrayContaining(['venda']),
        interests: expect.arrayContaining(['produto']),
        summary: expect.stringContaining('Cliente:'),
      }),
      undefined,
    );
  });

  it('should detect positive sentiment from text', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Perfeito, quero fechar!',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment: 'POSITIVE',
      }),
      undefined,
    );
  });

  it('should detect loss reason from text mentioning price objection', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Está muito caro, não quero mais',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lossReason: 'preço',
      }),
      undefined,
    );
  });

  it('should detect negative sentiment from clearly negative text', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Estou insatisfeito com o problema no atendimento',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment: 'NEGATIVE',
        tags: expect.arrayContaining(['risco']),
      }),
      undefined,
    );
  });

  it('should not save when text is empty or whitespace only', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: '   ',
    });

    expect(intelligenceRepository.save).not.toHaveBeenCalled();
  });

  it('should pass transaction client through options', async () => {
    const fakeTx = {} as any;

    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: 'Quero agendar uma consulta',
      options: { tx: fakeTx },
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining(['agenda']),
        interests: expect.arrayContaining(['agendamento']),
        nextStep: 'Oferecer horários disponiveis ou confirmar agendamento.',
      }),
      { tx: fakeTx },
    );
  });

  it('should resolve nextStep for outbound AI messages', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'OUTBOUND',
      sentBy: 'AI',
      text: 'Segue a proposta com os valores solicitados.',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('IA:'),
        nextStep: 'Acompanhar resposta do cliente e assumir se houver objeção.',
      }),
      undefined,
    );
  });

  it('should resolve nextStep for outbound HUMAN messages', async () => {
    await sut.captureMessageSignal({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      direction: 'OUTBOUND',
      sentBy: 'HUMAN',
      text: 'Bom dia, segue informações.',
    });

    expect(intelligenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('Operador:'),
        nextStep: 'Aguardar retorno do cliente.',
      }),
      undefined,
    );
  });
});
