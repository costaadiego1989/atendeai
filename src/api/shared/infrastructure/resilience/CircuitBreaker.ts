import { Logger } from '@nestjs/common';
import { CircuitOpenError } from './CircuitOpenError';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN. Default: 30000 */
  resetTimeoutMs?: number;
  /** Max attempts allowed in HALF_OPEN state before deciding. Default: 1 */
  halfOpenMaxAttempts?: number;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
};

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly options: Required<CircuitBreakerOptions>;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  constructor(
    private readonly name: string,
    options?: CircuitBreakerOptions,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = new Logger(`CircuitBreaker:${name}`);
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    const previous = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    if (previous !== CircuitState.CLOSED) {
      this.logTransition(previous, CircuitState.CLOSED, 'manual reset');
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.evaluateState();

    if (this.state === CircuitState.OPEN) {
      const retryAfter =
        this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime);
      throw new CircuitOpenError(this.name, Math.max(retryAfter, 0));
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return this.attemptHalfOpen(fn);
    }

    // CLOSED state
    return this.attemptClosed(fn);
  }

  // --- private helpers ---

  private evaluateState(): void {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.options.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN, 'reset timeout elapsed');
        this.halfOpenAttempts = 0;
      }
    }
  }

  private async attemptClosed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private async attemptHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    this.halfOpenAttempts++;

    if (this.halfOpenAttempts > this.options.halfOpenMaxAttempts) {
      this.transitionTo(CircuitState.OPEN, 'half-open attempts exhausted');
      this.lastFailureTime = Date.now();
      const retryAfter = this.options.resetTimeoutMs;
      throw new CircuitOpenError(this.name, retryAfter);
    }

    try {
      const result = await fn();
      this.transitionTo(CircuitState.CLOSED, 'half-open probe succeeded');
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
      return result;
    } catch (err) {
      this.transitionTo(CircuitState.OPEN, 'half-open probe failed');
      this.lastFailureTime = Date.now();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN, 'failure threshold reached');
    }
  }

  private transitionTo(newState: CircuitState, reason: string): void {
    const previous = this.state;
    this.state = newState;
    this.logTransition(previous, newState, reason);
  }

  private logTransition(
    from: CircuitState,
    to: CircuitState,
    reason: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'circuit_breaker.state_transition',
        service: this.name,
        from,
        to,
        reason,
        failureCount: this.failureCount,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
