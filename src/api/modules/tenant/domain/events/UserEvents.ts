import { DomainEvent } from '../../../../shared/domain/DomainEvent.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { RoleType } from '../../../../shared/domain/Role.js';

export class UserCreated extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly role: RoleType,
  ) {
    super(aggregateId);
  }
}
