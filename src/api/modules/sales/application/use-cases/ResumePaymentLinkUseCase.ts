import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISalesPaymentLinksRepository,
  SALES_PAYMENT_LINKS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '../../../payment/domain/ports/IPaymentGateway';

@Injectable()
export class ResumePaymentLinkUseCase {
  constructor(
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly salesRepository: ISalesPaymentLinksRepository,
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentGateway: IPaymentGateway,
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
      await this.paymentGateway.restorePayment(paymentLink.providerLinkId);
    } else {
      await this.paymentGateway.restorePaymentLink(paymentLink.providerLinkId);
    }

    const updated = await this.salesRepository.updatePaymentLinkStatus(
      input.tenantId,
      input.paymentLinkId,
      'ACTIVE',
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
