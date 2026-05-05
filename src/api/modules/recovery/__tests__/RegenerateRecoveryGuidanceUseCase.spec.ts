import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { RegenerateRecoveryGuidanceUseCase } from '../application/use-cases/RegenerateRecoveryGuidanceUseCase';

describe('RegenerateRecoveryGuidanceUseCase', () => {
  let recoveryRepository: any;
  let recoveryGuidanceGenerator: any;
  let sut: RegenerateRecoveryGuidanceUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      updateCaseGuidance: jest.fn(),
    };
    recoveryGuidanceGenerator = {
      generate: jest.fn(),
    };

    sut = new RegenerateRecoveryGuidanceUseCase(
      recoveryRepository,
      recoveryGuidanceGenerator,
    );
  });

  it('should regenerate guidance for an active case', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      chargeDescription: 'Plano premium unidade Centro',
      referencePeriod: '2030-07',
      relatedEntityType: 'SUBSCRIPTION',
      relatedEntityLabel: 'Plano Premium Centro',
      amountDue: '150.00',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      status: 'CONTACTED',
    });
    recoveryGuidanceGenerator.generate.mockResolvedValue({
      suggestedReply: 'Posso te orientar pelo boleto.',
      suggestedNextAction: 'Confirmar o meio de pagamento.',
    });
    recoveryRepository.updateCaseGuidance.mockResolvedValue({
      id: 'case-1',
      suggestedReply: 'Posso te orientar pelo boleto.',
      suggestedNextAction: 'Confirmar o meio de pagamento.',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      customerMessage: 'prefiro boleto',
    });

    expect(recoveryGuidanceGenerator.generate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      chargeDescription: 'Plano premium unidade Centro',
      referencePeriod: '2030-07',
      relatedEntityType: 'SUBSCRIPTION',
      relatedEntityLabel: 'Plano Premium Centro',
      amountDue: '150.00',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      status: 'CONTACTED',
      customerMessage: 'prefiro boleto',
    });
    expect(result).toEqual(
      expect.objectContaining({
        suggestedReply: 'Posso te orientar pelo boleto.',
      }),
    );
  });

  it('should reject guidance regeneration for closed cases', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-2',
      status: 'PAID',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-2',
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should reject guidance regeneration for invalid contact cases', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-3',
      status: 'INVALID_CONTACT',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-3',
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });
});
