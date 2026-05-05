import { DomainEvent } from '../../../../shared/domain/DomainEvent.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { PlanType } from '../value-objects/Plan.js';

export class TenantCreated extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly companyName: string,
    public readonly cnpj: string,
    public readonly plan: PlanType,
    public readonly ownerName: string,
    public readonly ownerEmail: string,
    public readonly ownerPhone: string,
    public readonly ownerPassword?: string,
    public readonly isTrial: boolean = false,
  ) {
    super(aggregateId);
  }
}

export class TenantPlanChanged extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly oldPlan: PlanType,
    public readonly newPlan: PlanType,
  ) {
    super(aggregateId);
  }
}

export class WhatsAppConfigured extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly whatsappNumber: string,
  ) {
    super(aggregateId);
  }
}

export class InstagramConfigured extends DomainEvent {
  constructor(
    aggregateId: UniqueEntityID,
    public readonly instagramAccountId: string,
  ) {
    super(aggregateId);
  }
}

export class AIConfigUpdated extends DomainEvent {
  constructor(aggregateId: UniqueEntityID) {
    super(aggregateId);
  }
}
