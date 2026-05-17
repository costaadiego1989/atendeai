import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { StructuredLogEmitter } from '../../observability/StructuredLogEmitter';
import { otelTraceLogFields } from '../../observability/otelTraceLogFields';

@Injectable()
export class HttpStructuredLoggingInterceptor implements NestInterceptor {
  constructor(private readonly log: StructuredLogEmitter) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const method = req.method;
    const path = String(req.route?.path ?? req.url);

    const user = req as Request & {
      user?: { tenantId?: string; role?: string; sub?: string };
    };

    const otel = otelTraceLogFields();
    const traceId = otel.traceId ?? '';
    const spanId = otel.spanId ?? '';

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const status = res.statusCode;
        const tenantId = user.user?.tenantId ?? '';

        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        this.log.emit({
          level,
          event: 'http.request.completed',
          message: `${method} ${path}`,
          tenantId,
          traceId,
          spanId,
          attributes: {
            'http.method': method,
            'http.route': path,
            'http.status_code': String(status),
            duration_ms: String(durationMs),
          },
        });
      }),
    );
  }
}
