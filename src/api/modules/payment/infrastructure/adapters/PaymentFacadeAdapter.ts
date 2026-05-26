import { Injectable } from '@nestjs/common';
import { PaymentService } from '../../application/services/PaymentService';
import {
  CreatePaymentLinkInput,
  IPaymentFacade,
  PaymentLinkOutput,
} from '../../application/facades/IPaymentFacade';
import { CreatePaymentLinkData } from '../../domain/ports/IPaymentGateway';

@Injectable()
export class PaymentFacadeAdapter implements IPaymentFacade {
  constructor(private readonly paymentService: PaymentService) {}

  async createPaymentLink(
    data: CreatePaymentLinkInput,
  ): Promise<PaymentLinkOutput> {
    const gatewayChargeType: CreatePaymentLinkData['chargeType'] =
      data.chargeType === 'RECURRENT' ? 'RECURRENT' : 'DETACHED';

    const result = await this.paymentService.createPaymentLink({
      name: data.name,
      description: data.description,
      value: data.value,
      externalReference: data.externalReference,
      billingType: data.billingType,
      chargeType: gatewayChargeType,
      dueDateLimitDays: data.dueDateLimitDays,
    });

    return { id: result.id, url: result.url };
  }

  async removePaymentLink(paymentLinkId: string): Promise<void> {
    await this.paymentService.removePaymentLink(paymentLinkId);
  }
}
