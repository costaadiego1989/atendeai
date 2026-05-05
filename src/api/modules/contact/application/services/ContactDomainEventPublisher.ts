import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { Contact } from '../../domain/entities/Contact';
import {
  ContactCreatedDomainEvent,
  ContactInteractionRecordedDomainEvent,
  ContactStageChangedDomainEvent,
  ContactUpdatedDomainEvent,
} from '../../domain/events/ContactEvents';
import {
  ContactCreatedIntegrationEvent,
  ContactInteractionRecordedIntegrationEvent,
  ContactStageChangedIntegrationEvent,
  ContactUpdatedIntegrationEvent,
} from '../integration-events/ContactIntegrationEvents';

@Injectable()
export class ContactDomainEventPublisher {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async publishFromAggregate(contact: Contact): Promise<void> {
    const integrationEvents = contact.domainEvents
      .map((event) => this.toIntegrationEvent(event))
      .filter((event): event is NonNullable<typeof event> => event !== null);

    for (const event of integrationEvents) {
      await this.eventBus.publish(event);
    }

    contact.clearEvents();
  }

  private toIntegrationEvent(
    event: Contact['domainEvents'][number],
  ):
    | ContactCreatedIntegrationEvent
    | ContactUpdatedIntegrationEvent
    | ContactStageChangedIntegrationEvent
    | ContactInteractionRecordedIntegrationEvent
    | null {
    if (event instanceof ContactCreatedDomainEvent) {
      return new ContactCreatedIntegrationEvent({
        contactId: event.aggregateId.toValue(),
        tenantId: event.tenantId,
        name: event.name,
        phone: event.phone,
        email: event.email,
        stage: event.stage,
      });
    }

    if (event instanceof ContactUpdatedDomainEvent) {
      return new ContactUpdatedIntegrationEvent({
        contactId: event.aggregateId.toValue(),
        tenantId: event.tenantId,
        name: event.name,
        phone: event.phone,
        email: event.email,
        tags: event.tags,
        notes: event.notes,
        stage: event.stage,
      });
    }

    if (event instanceof ContactStageChangedDomainEvent) {
      return new ContactStageChangedIntegrationEvent({
        contactId: event.aggregateId.toValue(),
        tenantId: event.tenantId,
        previousStage: event.previousStage,
        newStage: event.newStage,
        changedAt: event.occurredOn.toISOString(),
      });
    }

    if (event instanceof ContactInteractionRecordedDomainEvent) {
      return new ContactInteractionRecordedIntegrationEvent({
        contactId: event.aggregateId.toValue(),
        tenantId: event.tenantId,
        lastInteraction: event.lastInteraction.toISOString(),
      });
    }

    return null;
  }
}
