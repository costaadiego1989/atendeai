import { Entity } from '@shared/domain/Entity';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Money } from '../value-objects/Money';

interface SessionItemProps {
  sessionId: string;
  tenantId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId: string | null;
  catalogItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface CreateSessionItemInput {
  id?: string;
  sessionId: string;
  tenantId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReconstructSessionItemInput {
  id: string;
  sessionId: string;
  tenantId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId: string | null;
  catalogItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SessionItem extends Entity<SessionItemProps> {
  private constructor(
    props: SessionItemProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  static create(input: CreateSessionItemInput): SessionItem {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    const currency = input.currency ?? 'BRL';
    const unitPrice = Money.create(input.unitPrice, currency);
    const lineTotal = unitPrice.multiply(input.quantity);

    return new SessionItem(
      {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        source: input.source,
        inventoryItemId: input.inventoryItemId ?? null,
        catalogItemId: input.catalogItemId ?? null,
        name: input.name,
        quantity: input.quantity,
        unitPrice,
        lineTotal,
      },
      input.id ? new UniqueEntityID(input.id) : undefined,
      input.createdAt,
      input.updatedAt,
    );
  }

  static reconstruct(input: ReconstructSessionItemInput): SessionItem {
    const currency = input.currency ?? 'BRL';
    return new SessionItem(
      {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        source: input.source,
        inventoryItemId: input.inventoryItemId,
        catalogItemId: input.catalogItemId,
        name: input.name,
        quantity: input.quantity,
        unitPrice: Money.create(input.unitPrice, currency),
        lineTotal: Money.create(input.lineTotal, currency),
      },
      new UniqueEntityID(input.id),
      input.createdAt,
      input.updatedAt,
    );
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get source(): 'INVENTORY' | 'CATALOG' {
    return this.props.source;
  }

  get inventoryItemId(): string | null {
    return this.props.inventoryItemId;
  }

  get catalogItemId(): string | null {
    return this.props.catalogItemId;
  }

  get name(): string {
    return this.props.name;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get lineTotal(): Money {
    return this.props.lineTotal;
  }

  get currency(): string {
    return this.props.unitPrice.currency;
  }
}
