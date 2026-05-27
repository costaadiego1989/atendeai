import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Money } from '../value-objects/Money';
import {
  SessionStatus,
  CommerceSessionStatusValue,
} from '../value-objects/SessionStatus';
import {
  SessionItem,
  CreateSessionItemInput,
  ReconstructSessionItemInput,
} from './SessionItem';

interface ShoppingSessionProps {
  tenantId: string;
  branchId: string | null;
  conversationId: string;
  contactId: string | null;
  status: SessionStatus;
  items: SessionItem[];
  subtotalAmount: Money;
  freightAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  fulfillmentType: 'PICKUP' | 'DELIVERY' | null;
  deliveryAddress: string | null;
  couponCode: string | null;
}

export interface ReconstructShoppingSessionInput {
  id: string;
  tenantId: string;
  branchId: string | null;
  conversationId: string;
  contactId: string | null;
  status: CommerceSessionStatusValue;
  items: ReconstructSessionItemInput[];
  subtotalAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  fulfillmentType: 'PICKUP' | 'DELIVERY' | null;
  deliveryAddress: string | null;
  couponCode: string | null;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ShoppingSession extends AggregateRoot<ShoppingSessionProps> {
  private constructor(
    props: ShoppingSessionProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  static reconstruct(input: ReconstructShoppingSessionInput): ShoppingSession {
    const currency = input.currency ?? 'BRL';
    const items = input.items.map((i) =>
      SessionItem.reconstruct({
        ...i,
        currency: i.currency ?? currency,
      }),
    );

    return new ShoppingSession(
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        status: SessionStatus.create(input.status),
        items,
        subtotalAmount: Money.create(input.subtotalAmount, currency),
        freightAmount: Money.create(input.freightAmount, currency),
        discountAmount: Money.create(input.discountAmount, currency),
        totalAmount: Money.create(input.totalAmount, currency),
        fulfillmentType: input.fulfillmentType,
        deliveryAddress: input.deliveryAddress,
        couponCode: input.couponCode,
      },
      new UniqueEntityID(input.id),
      input.createdAt,
      input.updatedAt,
    );
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get branchId(): string | null {
    return this.props.branchId;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get contactId(): string | null {
    return this.props.contactId;
  }

  get status(): CommerceSessionStatusValue {
    return this.props.status.value;
  }

  get items(): ReadonlyArray<SessionItem> {
    return this.props.items;
  }

  get subtotalAmount(): Money {
    return this.props.subtotalAmount;
  }

  get freightAmount(): Money {
    return this.props.freightAmount;
  }

  get discountAmount(): Money {
    return this.props.discountAmount;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get fulfillmentType(): 'PICKUP' | 'DELIVERY' | null {
    return this.props.fulfillmentType;
  }

  get deliveryAddress(): string | null {
    return this.props.deliveryAddress;
  }

  get couponCode(): string | null {
    return this.props.couponCode;
  }

  addItem(
    input: Omit<CreateSessionItemInput, 'sessionId' | 'tenantId'>,
  ): SessionItem {
    const item = SessionItem.create({
      ...input,
      sessionId: this.id.toString(),
      tenantId: this.props.tenantId,
    });
    this.props.items.push(item);
    this.recalculateTotals();
    return item;
  }

  recalculateTotals(discountOverride?: Money): void {
    const currency = this.props.subtotalAmount.currency;
    const subtotal = this.props.items.reduce(
      (acc, item) => acc.add(item.lineTotal),
      Money.zero(currency),
    );
    this.props.subtotalAmount = subtotal;

    if (discountOverride !== undefined) {
      this.props.discountAmount = discountOverride;
    }

    this.props.totalAmount = subtotal
      .add(this.props.freightAmount)
      .subtract(this.props.discountAmount);
  }

  computeCheckoutTotals(): {
    subtotal: Money;
    freight: Money;
    discount: Money;
    total: Money;
  } {
    const currency = this.props.subtotalAmount.currency;
    const subtotal = this.props.items.reduce(
      (acc, item) => acc.add(item.lineTotal),
      Money.zero(currency),
    );
    const freight = this.props.freightAmount;
    const discount = this.props.discountAmount;
    const total = subtotal.add(freight).subtract(discount);

    return { subtotal, freight, discount, total };
  }

  assertCanCheckout(): void {
    this.props.status.transitionTo('AWAITING_PAYMENT', this.id.toString());

    if (this.props.items.length === 0) {
      throw new Error('Add at least one item before checkout');
    }

    if (!this.props.fulfillmentType) {
      throw new Error('Select pickup or delivery before checkout');
    }

    if (
      this.props.fulfillmentType === 'DELIVERY' &&
      !this.props.deliveryAddress?.trim()
    ) {
      throw new Error('Delivery address is required before checkout');
    }
  }

  canTransitionTo(next: CommerceSessionStatusValue): boolean {
    return this.props.status.canTransitionTo(next);
  }

  transitionTo(next: CommerceSessionStatusValue): void {
    this.props.status = this.props.status.transitionTo(
      next,
      this.id.toString(),
    );
  }

  static computeLineTotal(
    unitPrice: number,
    quantity: number,
    currency = 'BRL',
  ): Money {
    const price = Money.create(unitPrice, currency);
    return price.multiply(quantity);
  }
}
