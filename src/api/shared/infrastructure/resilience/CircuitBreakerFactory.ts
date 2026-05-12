import { Injectable } from '@nestjs/common';
import { CircuitBreaker, CircuitBreakerOptions } from './CircuitBreaker';

@Injectable()
export class CircuitBreakerFactory {
  private readonly registry = new Map<string, CircuitBreaker>();

  /**
   * Returns an existing circuit breaker by name, or creates a new one
   * with the given options if it doesn't exist yet.
   */
  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    const existing = this.registry.get(name);
    if (existing) {
      return existing;
    }

    const breaker = new CircuitBreaker(name, options);
    this.registry.set(name, breaker);
    return breaker;
  }

  /**
   * Returns all registered breaker names (useful for health checks).
   */
  getRegisteredNames(): string[] {
    return Array.from(this.registry.keys());
  }
}
