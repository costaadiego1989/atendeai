import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { OnboardTrialTenantUseCase } from '../use-cases/OnboardTrialTenantUseCase';

@Injectable()
export class TrialPaymentConfirmedHandler implements OnModuleInit {
  private readonly logger = new Logger(TrialPaymentConfirmedHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly onboardTrialTenantUseCase: OnboardTrialTenantUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'payment.trial-confirmed',
      async (event: any) => {
        await this.handle(event);
      },
      { consumerName: 'tenant-trial-payment-confirmed' },
    );
  }

  private async handle(event: any): Promise<void> {
    const payload = event.payload || event;
    const { plan, companyName, ownerName, ownerEmail, ownerPhone } = payload;

    this.logger.log(
      `Received trial payment confirmed for ${ownerEmail}. Starting onboarding...`,
    );

    try {
      await this.onboardTrialTenantUseCase.execute({
        plan,
        companyName,
        ownerName,
        ownerEmail,
        ownerPhone,
      });
      this.logger.log(`Trial onboarding completed for ${ownerEmail}`);
    } catch (error) {
      this.logger.error(`Trial onboarding failed for ${ownerEmail}`, error);
    }
  }
}
