import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONTACT_FACADE, IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@modules/tenant/domain/repositories/IUserRepository';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '../facades/MessagingFacade';

@Injectable()
export class BillingQuotaMessagingHandlers implements OnModuleInit {
  private readonly logger = new Logger(BillingQuotaMessagingHandlers.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    @Inject(CONTACT_FACADE)
    private readonly contacts: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messaging: IMessagingFacade,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'billing.quota-warning',
      async (event) => this.handleWarning(event),
      { consumerName: 'messaging-billing-quota-warning' },
    );
    this.eventBus.subscribe(
      'billing.quota-exceeded',
      async (event) => this.handleExceeded(event),
      { consumerName: 'messaging-billing-quota-exceeded' },
    );
  }

  private async handleWarning(event: IntegrationEvent) {
    const p = event.payload as {
      tenantId?: string;
      type?: string;
      percentUsed?: number;
      used?: number;
      quota?: number;
    };
    if (
      typeof p.tenantId !== 'string' ||
      typeof p.type !== 'string' ||
      typeof p.percentUsed !== 'number'
    ) {
      return;
    }
    const label = this.usageTypeLabel(p.type);
    const pct = Math.round(p.percentUsed);
    const text =
      `AtendeAí: aviso de cota (${label})\n\n` +
      `Já utilizou cerca de ${pct}% da cota deste ciclo. ` +
      (typeof p.used === 'number' && typeof p.quota === 'number'
        ? `Consumo: ${p.used} de ${p.quota}.\n\n`
        : '\n') +
      `Para evitar interrupções, avalie aumentar ou ajustar o plano antes de esgotar a cota.`;

    await this.notifyOwnerQuietly(p.tenantId, text, 'quota-warning');
  }

  private async handleExceeded(event: IntegrationEvent) {
    const p = event.payload as {
      tenantId?: string;
      type?: string;
      used?: number;
      quota?: number;
    };
    if (typeof p.tenantId !== 'string' || typeof p.type !== 'string') {
      return;
    }
    const label = this.usageTypeLabel(p.type);
    const text =
      `AtendeAí: limite de ${label} esgotado neste ciclo.\n\n` +
      (typeof p.used === 'number' && typeof p.quota === 'number'
        ? `Consumo: ${p.used} de ${p.quota}. `
        : '') +
      `Até o ciclo renovar ou o plano ser ajustado, recursos dependentes dessa cota podem ficar bloqueados.`;

    await this.notifyOwnerQuietly(p.tenantId, text, 'quota-exceeded');
  }

  private usageTypeLabel(type: string): string {
    switch (type) {
      case 'MESSAGE':
        return 'mensagens';
      case 'AI_TOKEN':
        return 'tokens de IA';
      case 'CONTACT':
        return 'contatos';
      default:
        return type;
    }
  }

  private async notifyOwnerQuietly(
    tenantId: string,
    text: string,
    reason: string,
  ) {
    try {
      const owner = await this.users.findOwnerPrincipalByTenantId(tenantId);
      if (!owner?.phone?.trim()) {
        this.logger.warn(
          `Skip billing ${reason}: no owner phone for tenant ${tenantId}`,
        );
        return;
      }

      const { contactId } = await this.contacts.ensureContact({
        tenantId,
        name: owner.name,
        phone: owner.phone.trim(),
        stage: 'CUSTOMER',
      });

      await this.messaging.queueSystemMessage({
        tenantId,
        contactId,
        channel: 'WHATSAPP',
        text,
      });
    } catch (err) {
      this.logger.error(
        `billing ${reason} WhatsApp enqueue failed (${tenantId})`,
        err,
      );
    }
  }
}
