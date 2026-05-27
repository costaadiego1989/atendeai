import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISalesPaymentLinksRepository,
  SALES_PAYMENT_LINKS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '@modules/payment/application/facades/IPaymentFacade';

@Injectable()
export class PausePaymentLinkUseCase {
  constructor(
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly salesRepository: ISalesPaymentLinksRepository,
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
  ) {}

  async execute(input: { tenantId: string; paymentLinkId: string }) {
    const paymentLink = await this.salesRepository.findPaymentLinkById(
      input.tenantId,
      input.paymentLinkId,
    );

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found');
    }

    if (paymentLink.resourceType === 'PAYMENT') {
      await this.paymentFacade.deletePayment(paymentLink.providerLinkId);
    } else {
      await this.paymentFacade.removePaymentLink(paymentLink.providerLinkId);
    }

    const updated = await this.salesRepository.updatePaymentLinkStatus(
      input.tenantId,
      input.paymentLinkId,
      'PAUSED',
      null,
    );

    if (!updated) {
      throw new NotFoundException('Payment link not found');
    }

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
