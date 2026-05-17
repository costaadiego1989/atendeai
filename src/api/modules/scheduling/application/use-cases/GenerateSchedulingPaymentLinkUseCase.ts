import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from '@modules/payment/application/services/PaymentService';
import {
  ISchedulingStore,
  SCHEDULING_STORE,
} from '../../domain/ports/ISchedulingStore';
import {
  ISchedulingFacade,
  SCHEDULING_FACADE,
} from '../facades/SchedulingFacade';
import { buildSchedulingPaymentReference } from '../services/SchedulingPaymentReference';

type BillingType = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

@Injectable()
export class GenerateSchedulingPaymentLinkUseCase {
  constructor(
    @Inject(SCHEDULING_STORE)
    private readonly schedulingStore: ISchedulingStore,
    @Inject(SCHEDULING_FACADE)
    private readonly schedulingFacade: ISchedulingFacade,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    professionalId: string;
    slotId: string;
    date: string;
    billingType?: BillingType;
  }) {
    const slot = await this.schedulingStore.getAvailabilitySlot(
      input.tenantId,
      input.professionalId,
      input.date,
      input.slotId,
    );

    if (!slot) {
      throw new NotFoundException('Availability slot not found');
    }

    if (slot.status !== 'RESERVED' && slot.status !== 'PRE_RESERVED') {
      throw new ConflictException(
        'Payment link can only be generated for reserved or pre-reserved slots',
      );
    }

    const categories = await this.schedulingFacade.listCategories(
      input.tenantId,
      input.branchId,
    );
    const category = slot.reservedFor?.categoryId
      ? categories.find((entry) => entry.id === slot.reservedFor?.categoryId)
      : null;

    const amount = slot.customPrice ?? category?.basePrice ?? null;

    if (amount == null) {
      throw new BadRequestException(
        'Configure a slot price or category base price before generating payment',
      );
    }

    const paymentReference = buildSchedulingPaymentReference({
      tenantId: input.tenantId,
      professionalId: input.professionalId,
      date: input.date,
      slotId: input.slotId,
    });

    const serviceName =
      category?.name || slot.label || 'Agendamento de serviço';
    const customerName =
      slot.reservedFor?.contactName ||
      slot.reservedFor?.contactEmail ||
      'cliente';
    const billingType = input.billingType || 'PIX';

    const paymentLink = await this.paymentService.createPaymentLink({
      name: serviceName,
      description: `${serviceName} agendado para ${customerName} em ${input.date}`,
      value: amount,
      externalReference: paymentReference,
      billingType,
      chargeType: 'DETACHED',
      dueDateLimitDays: 3,
    });

    const updatedSlot =
      await this.schedulingStore.attachPaymentLinkToReservedSlot({
        tenantId: input.tenantId,
        professionalId: input.professionalId,
        date: input.date,
        slotId: input.slotId,
        reference: paymentReference,
        linkId: paymentLink.id,
        linkUrl: paymentLink.url,
        amount,
        billingType,
      });

    if (!updatedSlot) {
      throw new ConflictException(
        'Could not attach payment link to reserved slot',
      );
    }

    return {
      id: paymentLink.id,
      url: paymentLink.url,
      paymentReference,
      amount,
      billingType,
      status: updatedSlot.payment?.status || 'PENDING',
    };
  }
}
