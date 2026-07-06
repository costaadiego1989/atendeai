import { AIRecoveryGuidanceGenerator } from '../infrastructure/adapters/AIRecoveryGuidanceGenerator';
import { IAIEngine } from '../../ai/application/ports/IAIEngine';

describe('AIRecoveryGuidanceGenerator', () => {
  let aiEngine: jest.Mocked<IAIEngine>;
  let sut: AIRecoveryGuidanceGenerator;

  beforeEach(() => {
    aiEngine = {
      generateResponse: jest.fn(),
      generateStructuredResponse: jest.fn(),
      generateTextResponse: jest.fn(),
    };

    sut = new AIRecoveryGuidanceGenerator(aiEngine);
  });

  it('should parse structured JSON guidance from the AI response', async () => {
    aiEngine.generateStructuredResponse.mockResolvedValue({
      suggestedReply: 'Pode me confirmar se prefere pix ou boleto?',
      suggestedNextAction: 'Confirmar meio de pagamento e reenviar o link.',
    });

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      amountDue: '99.90',
      status: 'NEGOTIATING',
      customerMessage: 'quero negociar',
    });

    expect(result).toEqual({
      suggestedReply: 'Pode me confirmar se prefere pix ou boleto?',
      suggestedNextAction: 'Confirmar meio de pagamento e reenviar o link.',
    });
  });

  it('should fall back to deterministic guidance when structured AI fails', async () => {
    aiEngine.generateStructuredResponse.mockRejectedValue(
      new Error('Structured output parsing failed'),
    );

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      chargeTitle: 'Mensalidade de julho',
      amountDue: '99.90',
      status: 'PROMISE_TO_PAY',
      customerMessage: 'vou pagar hoje',
    });

    expect(result.suggestedReply).toContain('obrigado');
    expect(result.suggestedReply).toContain('Mensalidade de julho');
    expect(result.suggestedNextAction).toContain('Confirmar');
  });
});
