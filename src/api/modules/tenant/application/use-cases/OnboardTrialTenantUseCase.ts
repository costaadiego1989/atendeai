import { Inject, Injectable, Logger } from '@nestjs/common';
import { ICreateTenantUseCase } from './interfaces/ICreateTenantUseCase';

export interface OnboardTrialTenantInput {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: string;
}

@Injectable()
export class OnboardTrialTenantUseCase {
  private readonly logger = new Logger(OnboardTrialTenantUseCase.name);

  constructor(
    @Inject(ICreateTenantUseCase)
    private readonly createTenantUseCase: ICreateTenantUseCase,
  ) {}

  async execute(input: OnboardTrialTenantInput): Promise<void> {
    this.logger.log(
      `Starting onboarding for trial tenant: ${input.companyName} (${input.ownerEmail})`,
    );

    const tempPassword = Math.random().toString(36).slice(-8);

    await this.createTenantUseCase.execute({
      companyName: input.companyName,
      cnpj: '00000000000000',
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      ownerPhone: input.ownerPhone,
      ownerPassword: tempPassword,
      plan: input.plan,
      isTrial: true,
    });
  }
}
