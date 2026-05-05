import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { SKIP_SUCCESS_ENVELOPE_KEY } from '../decorators/skip-success-envelope.decorator';

export interface Response<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class SuccessResponseInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUCCESS_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: context.switchToHttp().getResponse().statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
