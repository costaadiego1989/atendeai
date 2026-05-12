/**
 * Thrown when a circuit breaker is in the OPEN state and rejects a call
 * without forwarding it to the downstream service.
 */
export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(
      `Circuit breaker "${serviceName}" is OPEN. Retry after ${retryAfterMs}ms.`,
    );
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, CircuitOpenError.prototype);
  }
}
