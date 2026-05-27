import { ValueObject } from '@shared/domain/ValueObject';
import { InvalidSessionStateError } from '../errors/InvalidSessionStateError';

export type CommerceSessionStatusValue =
  | 'BUILDING_CART'
  | 'READY_FOR_CHECKOUT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED';

interface SessionStatusProps {
  value: CommerceSessionStatusValue;
}

const SESSION_TRANSITIONS: Record<
  CommerceSessionStatusValue,
  CommerceSessionStatusValue[]
> = {
  BUILDING_CART: ['READY_FOR_CHECKOUT', 'CANCELLED'],
  READY_FOR_CHECKOUT: ['AWAITING_PAYMENT', 'BUILDING_CART', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED', 'BUILDING_CART'],
  PAID: [],
  CANCELLED: [],
};

export class SessionStatus extends ValueObject<SessionStatusProps> {
  private constructor(props: SessionStatusProps) {
    super(props);
  }

  static create(value: CommerceSessionStatusValue): SessionStatus {
    return new SessionStatus({ value });
  }

  static buildingCart(): SessionStatus {
    return new SessionStatus({ value: 'BUILDING_CART' });
  }

  static awaitingPayment(): SessionStatus {
    return new SessionStatus({ value: 'AWAITING_PAYMENT' });
  }

  static paid(): SessionStatus {
    return new SessionStatus({ value: 'PAID' });
  }

  static cancelled(): SessionStatus {
    return new SessionStatus({ value: 'CANCELLED' });
  }

  get value(): CommerceSessionStatusValue {
    return this.props.value;
  }

  isTerminal(): boolean {
    return this.props.value === 'PAID' || this.props.value === 'CANCELLED';
  }

  canTransitionTo(next: CommerceSessionStatusValue): boolean {
    return SESSION_TRANSITIONS[this.props.value].includes(next);
  }

  transitionTo(
    next: CommerceSessionStatusValue,
    sessionId: string,
  ): SessionStatus {
    if (!this.canTransitionTo(next)) {
      throw new InvalidSessionStateError(sessionId, this.props.value, next);
    }
    return SessionStatus.create(next);
  }
}
