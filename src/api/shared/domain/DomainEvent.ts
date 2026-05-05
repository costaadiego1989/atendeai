import { UniqueEntityID } from './UniqueEntityID';

export interface IDomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly aggregateId: UniqueEntityID;
}

export abstract class DomainEvent implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly aggregateId: UniqueEntityID;

  protected constructor(aggregateId: UniqueEntityID) {
    this.eventId = new UniqueEntityID().toValue();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
  }
}
