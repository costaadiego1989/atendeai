import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TrialPaymentProjectionService {
  private readonly logger = new Logger(TrialPaymentProjectionService.name);

  async project(input: {
    eventType: string;
    rawReference?: string;
  }): Promise<void> {
    if (
      input.eventType !== 'PAYMENT_CONFIRMED' ||
      !input.rawReference?.startsWith('trial|')
    ) {
      return;
    }

    const parts = input.rawReference.split('|');
    if (parts.length < 2) {
      return;
    }

    const tenantId = parts[1];

    this.logger.log(`Trial payment confirmed for tenantId=${tenantId}`);
  }
}
