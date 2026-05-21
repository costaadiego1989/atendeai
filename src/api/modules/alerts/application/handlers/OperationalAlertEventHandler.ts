import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@modules/tenant/domain/repositories/IUserRepository';

@Injectable()
export class OperationalAlertEventHandler implements OnModuleInit {
  private readonly logger = new Logger(OperationalAlertEventHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'scheduling.professional_slot.reserved',
      async (event) => {
        await this.handleSchedulingReserved(
          event.payload as unknown as SchedulingReservedPayload,
        );
      },
      { consumerName: 'alerts' },
    );

    this.eventBus.subscribe(
      'scheduling.professional_slot.payment_confirmed',
      async (event) => {
        await this.handleSchedulingPaymentConfirmed(
          event.payload as unknown as SchedulingPaymentConfirmedPayload,
        );
      },
      { consumerName: 'alerts' },
    );

    this.eventBus.subscribe(
      'commerce.order.paid',
      async (event) => {
        await this.handleCommerceOrderPaid(
          event.payload as unknown as CommerceOrderPaidPayload,
        );
      },
      { consumerName: 'alerts' },
    );
  }

  async handleSchedulingReserved(
    payload: SchedulingReservedPayload,
  ): Promise<void> {
    const text =
      `*Novo agendamento confirmado*\n\n` +
      `Profissional: ${payload.professionalName}\n` +
      `Serviço: ${payload.categoryName}\n` +
      `Data: ${payload.date}\n` +
      `Horário: ${payload.startsAt} - ${payload.endsAt}`;

    await this.notifyTenantUsers(payload.tenantId, payload.branchId, text);
  }

  async handleSchedulingPaymentConfirmed(
    payload: SchedulingPaymentConfirmedPayload,
  ): Promise<void> {
    const text =
      `*Agendamento com pagamento confirmado*\n\n` +
      `Profissional: ${payload.professionalName}\n` +
      `Serviço: ${payload.categoryName}\n` +
      `Data: ${payload.date}\n` +
      `Horário: ${payload.startsAt} - ${payload.endsAt}\n` +
      `${payload.contactName ? `Cliente: ${payload.contactName}\n` : ''}` +
      `Status: pagamento confirmado`;

    await this.notifyTenantUsers(payload.tenantId, payload.branchId, text);
  }

  async handleCommerceOrderPaid(
    payload: CommerceOrderPaidPayload,
  ): Promise<void> {
    const formattedAmount = (payload.totalAmount / 100).toLocaleString(
      'pt-BR',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );

    const text =
      `*Nova venda realizada*\n\n` +
      `Pedido: ${payload.orderId}\n` +
      `Valor: R$ ${formattedAmount}\n` +
      `Status: pagamento confirmado`;

    await this.notifyTenantUsers(payload.tenantId, null, text);
  }

  private async notifyTenantUsers(
    tenantId: string,
    branchId: string | null | undefined,
    text: string,
  ): Promise<void> {
    const users = await this.userRepository.findAllByTenant(tenantId);

    for (const user of users) {
      const phone = user.phone?.value;
      if (!phone) continue;

      try {
        const { contactId } = await this.contactFacade.ensureContact({
          tenantId,
          name: user.name,
          phone,
          branchId: branchId ?? undefined,
          tags: ['internal_alerts'],
        });

        await this.messagingFacade.queueSystemMessage({
          tenantId,
          contactId,
          branchId: branchId ?? null,
          channel: 'WHATSAPP',
          text,
        });
      } catch (error) {
        this.logger.warn(
          `operational_alert_failed tenant=${tenantId} user=${user.id?.toValue?.()} error=${(error as Error).message}`,
        );
      }
    }
  }
}

interface SchedulingReservedPayload {
  tenantId: string;
  contactId: string;
  professionalName: string;
  categoryName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  branchId: string | null;
  meetingUrl?: string;
}

interface SchedulingPaymentConfirmedPayload {
  tenantId: string;
  contactId: string;
  contactName?: string;
  professionalName: string;
  categoryName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  branchId: string | null;
  meetingUrl?: string;
}

interface CommerceOrderPaidPayload {
  orderId: string;
  tenantId: string;
  paidAt: Date;
  totalAmount: number;
}
