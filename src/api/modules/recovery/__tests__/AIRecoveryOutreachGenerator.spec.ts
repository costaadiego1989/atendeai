import { AIRecoveryOutreachGenerator } from '../infrastructure/adapters/AIRecoveryOutreachGenerator';
import { IAIEngine } from '../../ai/application/ports/IAIEngine';

describe('AIRecoveryOutreachGenerator', () => {
  let aiEngine: jest.Mocked<IAIEngine>;
  let sut: AIRecoveryOutreachGenerator;

  beforeEach(() => {
    aiEngine = {
      generateResponse: jest.fn(),
    };

    sut = new AIRecoveryOutreachGenerator(aiEngine);
  });

  it('should return the AI-generated outreach text when available', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Oi, Carla. Identifiquei uma pendencia e posso te ajudar a regularizar por aqui.',
      tokensUsed: 35,
      confidence: 0.92,
      finishReason: 'stop',
    });

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Carla',
      debtorCompanyName: 'Locadora Centro',
      chargeType: 'RENTAL',
      chargeTitle: 'Locação do equipamento XPTO',
      chargeDescription: 'Diaria pendente do equipamento XPTO',
      relatedEntityType: 'RENTAL_RESERVATION',
      relatedEntityLabel: 'Reserva XPTO',
      amountDue: '120.00',
      assignedTags: ['atraso-30d'],
    });

    expect(result).toContain('Carla');
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.stringContaining('Locação do equipamento XPTO'),
      }),
    );
  });

  it('should fall back to a deterministic first message when AI fails', async () => {
    aiEngine.generateResponse.mockRejectedValue(new Error('provider down'));

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Carla',
      debtorCompanyName: 'Locadora Centro',
      chargeTitle: 'Locação do equipamento XPTO',
      amountDue: '120.00',
      assignedTags: [],
    });

    expect(result).toContain('Carla');
    expect(result).toContain('Locação do equipamento XPTO');
    expect(result).toContain('R$ 120,00');
  });
});
