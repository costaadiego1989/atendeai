import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StructuredLogEmitter } from './StructuredLogEmitter';
import { HttpStructuredLoggingInterceptor } from '../http/interceptors/HttpStructuredLoggingInterceptor';

@Global()
@Module({
  providers: [
    StructuredLogEmitter,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpStructuredLoggingInterceptor,
    },
  ],
  exports: [StructuredLogEmitter],
})
export class ObservabilityModule {}
