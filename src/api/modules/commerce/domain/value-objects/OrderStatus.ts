import { ValueObject } from '@shared/domain/ValueObject';

export type CommerceOrderStatusValue =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

interface OrderStatusProps {
  value: CommerceOrderStatusValue;
}

const ORDER_TRANSITIONS: Record<
  CommerceOrderStatusValue,
  CommerceOrderStatusValue[]
> = {
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: [
    'PREPARING',
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ],
  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export class OrderStatus extends ValueObject<OrderStatusProps> {
  private constructor(props: OrderStatusProps) {
    super(props);
  }

  static create(value: CommerceOrderStatusValue): OrderStatus {
    return new OrderStatus({ value });
  }

  static awaitingPayment(): OrderStatus {
    return new OrderStatus({ value: 'AWAITING_PAYMENT' });
  }

  static paid(): OrderStatus {
    return new OrderStatus({ value: 'PAID' });
  }

  static cancelled(): OrderStatus {
    return new OrderStatus({ value: 'CANCELLED' });
  }

  get value(): CommerceOrderStatusValue {
    return this.props.value;
  }

  isTerminal(): boolean {
    return this.props.value === 'DELIVERED' || this.props.value === 'CANCELLED';
  }

  isPaid(): boolean {
    return this.props.value === 'PAID';
  }

  canTransitionTo(next: CommerceOrderStatusValue): boolean {
    return ORDER_TRANSITIONS[this.props.value].includes(next);
  }

  transitionTo(next: CommerceOrderStatusValue, orderId: string): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new InvalidOrderTransitionError(orderId, this.props.value, next);
    }
    return OrderStatus.create(next);
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    orderId: string,
    currentStatus: CommerceOrderStatusValue,
    targetStatus: CommerceOrderStatusValue,
  ) {
    super(
      `Cannot change order ${orderId} status from ${currentStatus} to ${targetStatus}`,
    );
    this.name = 'InvalidOrderTransitionError';
  }
}
