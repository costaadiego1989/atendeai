import { OnboardTrialTenantUseCase } from '../application/use-cases/OnboardTrialTenantUseCase.js';
import { ICreateTenantUseCase } from '../application/use-cases/interfaces/ICreateTenantUseCase.js';

describe('OnboardTrialTenantUseCase', () => {
  let useCase: OnboardTrialTenantUseCase;
  let createTenantUseCase: jest.Mocked<ICreateTenantUseCase>;

  beforeEach(() => {
    createTenantUseCase = {
      execute: jest.fn(),
    };

    useCase = new OnboardTrialTenantUseCase(createTenantUseCase);
  });

  it('should call CreateTenantUseCase with trial parameters and temporary password', async () => {
    const input = {
      companyName: 'Trial Corp',
      ownerName: 'Admin',
      ownerEmail: 'admin@trial.com',
      ownerPhone: '5511999998888',
      plan: 'ESSENCIAL',
    };

    await useCase.execute(input);

    expect(createTenantUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: input.companyName,
        cnpj: '00000000000000',
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        plan: input.plan,
        isTrial: true,
        ownerPassword: expect.stringMatching(/^[a-z0-9]{8}$/),
      }),
    );
  });
});
