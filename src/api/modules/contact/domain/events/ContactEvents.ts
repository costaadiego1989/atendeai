import { DomainEvent } from '../../../../shared/domain/DomainEvent';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export class ContactCreatedDomainEvent extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly phone: string,
    public readonly email?: string,
    public readonly stage = 'LEAD',
  ) {
    super(aggregateId);
  }
}

export class ContactUpdatedDomainEvent extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly phone: string,
    public readonly email: string | undefined,
    public readonly tags: string[],
    public readonly stage: string,
    public readonly notes?: string,
  ) {
    super(aggregateId);
  }
}

export class ContactStageChangedDomainEvent extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly tenantId: string,
    public readonly previousStage: string,
    public readonly newStage: string,
  ) {
    super(aggregateId);
  }
}

export class ContactInteractionRecordedDomainEvent extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly tenantId: string,
    public readonly lastInteraction: Date,
  ) {
    super(aggregateId);
  }
}
