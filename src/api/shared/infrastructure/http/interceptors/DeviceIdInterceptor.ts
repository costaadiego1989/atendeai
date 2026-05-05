import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

export const DEVICE_ID_COOKIE_NAME = 'device_id';

const DEVICE_ID_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 365,
};

@Injectable()
export class DeviceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { deviceId?: string }>();
    const response = httpContext.getResponse<Response>();

    const incomingDeviceId = request.cookies?.[DEVICE_ID_COOKIE_NAME];
    const existingDeviceId = incomingDeviceId ?? request.deviceId;
    const deviceId = existingDeviceId || randomUUID();

    request.deviceId = deviceId;
    request.cookies = {
      ...(request.cookies ?? {}),
      [DEVICE_ID_COOKIE_NAME]: deviceId,
    };

    return next.handle().pipe(
      tap(() => {
        if (!incomingDeviceId) {
          response.cookie(
            DEVICE_ID_COOKIE_NAME,
            deviceId,
            DEVICE_ID_COOKIE_OPTIONS,
          );
        }
      }),
    );
  }
}
