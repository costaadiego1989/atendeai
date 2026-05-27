import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Money } from '../value-objects/Money';
import {
  OrderStatus,
  CommerceOrderStatusValue,
  InvalidOrderTransitionError,
} from '../value-objects/OrderStatus';

interface CommerceOrderProps {
  tenantId: string;
  branchId: string | null;
  sessionId: string;
  conversationId: string;
  contactId: string | null;
  status: OrderStatus;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  shippingMode: string | null;
  subtotalAmount: Money;
  freightAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  deliveryAddress: string | null;
  paymentReference: string;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  paymentStatus: string;
  couponCode: string | null;
}

export interface CreateCommerceOrderInput {
  id?: string;
  tenantId: string;
  branchId: string | null;
  sessionId: string;
  conversationId: string;
  contactId: string | null;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  shippingMode: string | null;
  subtotalAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  deliveryAddress: string | null;
  paymentReference: string;
  couponCode: string | null;
  currency?: string;
}

export interface ReconstructCommerceOrderInput extends CreateCommerceOrderInput {
  id: string;
  status: CommerceOrderStatusValue;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  paymentStatus: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CommerceOrder extends AggregateRoot<CommerceOrderProps> {
  private constructor(
    props: CommerceOrderProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  static create(input: CreateCommerceOrderInput): CommerceOrder {
    const currency = input.currency ?? 'BRL';

    return new CommerceOrder(
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        status: OrderStatus.awaitingPayment(),
        fulfillmentType: input.fulfillmentType,
        shippingMode: input.shippingMode,
        subtotalAmount: Money.create(input.subtotalAmount, currency),
        freightAmount: Money.create(input.freightAmount, currency),
        discountAmount: Money.create(input.discountAmount, currency),
        totalAmount: Money.create(input.totalAmount, currency),
        deliveryAddress: input.deliveryAddress,
        paymentReference: input.paymentReference,
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'PENDING',
        couponCode: input.couponCode,
      },
      input.id ? new UniqueEntityID(input.id) : undefined,
    );
  }

  static reconstruct(input: ReconstructCommerceOrderInput): CommerceOrder {
    const currency = input.currency ?? 'BRL';

    return new CommerceOrder(
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        status: OrderStatus.create(input.status),
        fulfillmentType: input.fulfillmentType,
        shippingMode: input.shippingMode,
        subtotalAmount: Money.create(input.subtotalAmount, currency),
        freightAmount: Money.create(input.freightAmount, currency),
        discountAmount: Money.create(input.discountAmount, currency),
        totalAmount: Money.create(input.totalAmount, currency),
        deliveryAddress: input.deliveryAddress,
        paymentReference: input.paymentReference,
        paymentLinkId: input.paymentLinkId,
        paymentLinkUrl: input.paymentLinkUrl,
        paymentStatus: input.paymentStatus,
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

  get sessionId(): string {
    return this.props.sessionId;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get contactId(): string | null {
    return this.props.contactId;
  }

  get status(): CommerceOrderStatusValue {
    return this.props.status.value;
  }

  get fulfillmentType(): 'PICKUP' | 'DELIVERY' {
    return this.props.fulfillmentType;
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

  get paymentReference(): string {
    return this.props.paymentReference;
  }

  get isPaid(): boolean {
    return this.props.status.isPaid();
  }

  get isTerminal(): boolean {
    return this.props.status.isTerminal();
  }

  canTransitionTo(next: CommerceOrderStatusValue): boolean {
    return this.props.status.canTransitionTo(next);
  }

  transitionTo(next: CommerceOrderStatusValue): void {
    this.props.status = this.props.status.transitionTo(
      next,
      this.id.toString(),
    );
  }

  assertValidTransition(next: CommerceOrderStatusValue): void {
    if (!this.props.status.canTransitionTo(next)) {
      throw new InvalidOrderTransitionError(
        this.id.toString(),
        this.props.status.value,
        next,
      );
    }
  }
}
