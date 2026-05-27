export class PaymentGatewayException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}

export class PaymentGatewayUnavailableException extends PaymentGatewayException {
  constructor(message: string, details?: string) {
    super(message, 'PAYMENT_GATEWAY_UNAVAILABLE', 503, details);
    this.name = 'PaymentGatewayUnavailableException';
  }
}

export class PaymentGatewayValidationException extends PaymentGatewayException {
  constructor(message: string, details?: string) {
    super(message, 'PAYMENT_GATEWAY_VALIDATION', 422, details);
    this.name = 'PaymentGatewayValidationException';
  }
}

export class PaymentGatewayConflictException extends PaymentGatewayException {
  constructor(message: string, details?: string) {
    super(message, 'PAYMENT_GATEWAY_CONFLICT', 409, details);
    this.name = 'PaymentGatewayConflictException';
  }
}

export class PaymentGatewayNotFoundException extends PaymentGatewayException {
  constructor(message: string, details?: string) {
    super(message, 'PAYMENT_GATEWAY_NOT_FOUND', 404, details);
    this.name = 'PaymentGatewayNotFoundException';
  }
}

export class PaymentGatewayAuthenticationException extends PaymentGatewayException {
  constructor(message: string, details?: string) {
    super(message, 'PAYMENT_GATEWAY_AUTHENTICATION', 401, details);
    this.name = 'PaymentGatewayAuthenticationException';
  }
}
