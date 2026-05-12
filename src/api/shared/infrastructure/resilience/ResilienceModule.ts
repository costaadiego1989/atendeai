import { Global, Module } from '@nestjs/common';
import { CircuitBreakerFactory } from './CircuitBreakerFactory';

@Global()
@Module({
  providers: [CircuitBreakerFactory],
  exports: [CircuitBreakerFactory],
})
export class ResilienceModule {}
