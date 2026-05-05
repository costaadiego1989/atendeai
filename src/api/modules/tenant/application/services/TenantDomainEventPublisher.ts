import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { Tenant } from '../../domain/entities/Tenant';
import {
  AIConfigUpdated,
  InstagramConfigured,
  TenantCreated,
  TenantPlanChanged,
  WhatsAppConfigured,
} from '../../domain/events/TenantEvents';
import {
  TenantAIConfigUpdatedIntegrationEvent,
  TenantCreatedIntegrationEvent,
  TenantInstagramConfiguredIntegrationEvent,
  TenantPlanChangedIntegrationEvent,
  TenantWhatsAppConfiguredIntegrationEvent,
} from '../integration-events/TenantIntegrationEvents';

@Injectable()
export class TenantDomainEventPublisher {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async publishFromAggregate(tenant: Tenant): Promise<void> {
    const integrationEvents = tenant.domainEvents
      .map((event) => this.toIntegrationEvent(event))
      .filter((event): event is NonNullable<typeof event> => event !== null);

    for (const event of integrationEvents) {
      await this.eventBus.publish(event);
    }

    tenant.clearEvents();
  }

  private toIntegrationEvent(
    event: Tenant['domainEvents'][number],
  ):
    | TenantCreatedIntegrationEvent
    | TenantWhatsAppConfiguredIntegrationEvent
    | TenantInstagramConfiguredIntegrationEvent
    | TenantAIConfigUpdatedIntegrationEvent
    | TenantPlanChangedIntegrationEvent
    | null {
    if (event instanceof TenantCreated) {
      return new TenantCreatedIntegrationEvent({
        aggregateId: event.aggregateId.toValue(),
        companyName: event.companyName,
        cnpj: event.cnpj,
        plan: event.plan,
        ownerName: event.ownerName,
        ownerEmail: event.ownerEmail,
        ownerPhone: event.ownerPhone,
        ownerPassword: event.ownerPassword,
        isTrial: event.isTrial,
      });
    }

    if (event instanceof WhatsAppConfigured) {
      return new TenantWhatsAppConfiguredIntegrationEvent({
        aggregateId: event.aggregateId.toValue(),
        whatsappNumber: event.whatsappNumber,
      });
    }

    if (event instanceof InstagramConfigured) {
      return new TenantInstagramConfiguredIntegrationEvent({
        aggregateId: event.aggregateId.toValue(),
        instagramAccountId: event.instagramAccountId,
      });
    }

    if (event instanceof AIConfigUpdated) {
      return new TenantAIConfigUpdatedIntegrationEvent({
        aggregateId: event.aggregateId.toValue(),
      });
    }

    if (event instanceof TenantPlanChanged) {
      return new TenantPlanChangedIntegrationEvent({
        aggregateId: event.aggregateId.toValue(),
        oldPlan: event.oldPlan,
        newPlan: event.newPlan,
      });
    }

    return null;
  }
}
