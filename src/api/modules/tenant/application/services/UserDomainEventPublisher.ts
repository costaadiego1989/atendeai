import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { User } from '../../domain/entities/User';
import { UserCreated } from '../../domain/events/UserEvents';
import { TenantUserCreatedIntegrationEvent } from '../integration-events/TenantIntegrationEvents';

@Injectable()
export class UserDomainEventPublisher {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async publishFromAggregate(user: User, tenantId: string): Promise<void> {
    const integrationEvents = user.domainEvents
      .map((event) => this.toIntegrationEvent(event, tenantId))
      .filter((event): event is NonNullable<typeof event> => event !== null);

    for (const event of integrationEvents) {
      await this.eventBus.publish(event);
    }

    user.clearEvents();
  }

  private toIntegrationEvent(
    event: User['domainEvents'][number],
    tenantId: string,
  ): TenantUserCreatedIntegrationEvent | null {
    if (event instanceof UserCreated) {
      return new TenantUserCreatedIntegrationEvent({
        userId: event.aggregateId.toValue(),
        tenantId,
        name: event.name,
        email: event.email,
        phone: event.phone,
        role: event.role,
      });
    }

    return null;
  }
}
