import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { isRecoveryPaymentReference } from '@shared/contracts/payment-references';
import {
  CommercialKind,
  CommercialModule,
  CommercialStatus,
} from './ConversationSaleContext';

export interface ConversationSaleEvidenceResult {
  confirmed: boolean;
  saleEligible: boolean;
  source?: 'PAYMENT_CONFIRMED';
  amount?: number | null;
  currency?: string | null;
  module?: CommercialModule;
  commercialKind?: CommercialKind;
  commercialStatus?: CommercialStatus;
  paymentLinkId?: string;
  reason?: string;
}

@Injectable()
export class ConversationSaleEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    tenantId: string,
    conversationId: string,
  ): Promise<ConversationSaleEvidenceResult> {
    const link = await this.prisma.paymentLink.findFirst({
      where: {
        tenantId,
        conversationId,
        status: 'PAID',
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        externalId: true,
        value: true,
        resourceType: true,
        label: true,
      },
    });

    if (!link) {
      return { confirmed: false, saleEligible: false };
    }

    const externalId = String(link.externalId ?? '');
    const label = String(link.label ?? '').toLowerCase();
    const isRecovery = isRecoveryPaymentReference(externalId);
    const module: CommercialModule = isRecovery
      ? 'RECOVERY'
      : label.includes('proposta')
        ? 'PROPOSAL'
        : 'CHECKOUT';
    const commercialKind: CommercialKind = isRecovery ? 'RECOVERY' : 'NEW_SALE';
    const commercialStatus: CommercialStatus = isRecovery
      ? 'RECOVERED'
      : 'PAYMENT_CONFIRMED';

    return {
      confirmed: true,
      saleEligible: !isRecovery,
      source: 'PAYMENT_CONFIRMED',
      amount: Number(link.value),
      currency: 'BRL',
      module,
      commercialKind,
      commercialStatus,
      paymentLinkId: link.id,
      reason: isRecovery
        ? 'Pagamento confirmado em recovery conta como receita recuperada, não como nova venda.'
        : undefined,
    };
  }
}
