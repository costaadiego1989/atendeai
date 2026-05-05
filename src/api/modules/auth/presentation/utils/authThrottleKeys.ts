import { Request } from 'express';
import { createHash } from 'crypto';

import {
  DEVICE_ID_COOKIE_NAME,
} from '@shared/infrastructure/http/interceptors/DeviceIdInterceptor';

const SAFE_DEVICE_HEADER = /^[a-zA-Z0-9_-]{8,128}$/;
const FALLBACK_FALLBACK_BUCKET = '_';

/**
 * Extrai IPv4/v6 público primeiro hop de proxies conhecidos (X-Forwarded-For).
 */
export function resolveAuthThrottleIp(request: Request): string {
  const forwardedForHeader = request.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader)
    ? forwardedForHeader[0]
    : forwardedForHeader;

  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    const firstHop = forwardedFor.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  }

  const ip = request.ip ?? request.socket?.remoteAddress ?? '';
  return typeof ip === 'string' && ip.trim().length > 0 ? ip.trim() : 'unknown';
}

/**
 * Preferência: cookie estável (`device_id`), header `x-device-id` (apps),
 * já resolvido no `request` (ex.: ciclo atual), último recurso fingerprint anónimo estável nesta sessão de rede/clients sem cookie nem header — evita “novo UUID a cada GET” antes do interceptor conseguir fixar cookie.
 */
export function resolveAuthThrottleDeviceId(
  request: Request & { deviceId?: string },
): string {
  const fromCookie = request.cookies?.[DEVICE_ID_COOKIE_NAME];
  if (typeof fromCookie === 'string' && SAFE_DEVICE_HEADER.test(fromCookie.trim())) {
    return fromCookie.trim();
  }

  const headerRaw = request.headers['x-device-id'];
  const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  if (
    typeof headerValue === 'string' &&
    SAFE_DEVICE_HEADER.test(headerValue.trim())
  ) {
    return headerValue.trim();
  }

  const fromRequest = request.deviceId;
  if (
    typeof fromRequest === 'string' &&
    SAFE_DEVICE_HEADER.test(fromRequest.trim())
  ) {
    return fromRequest.trim();
  }

  return anonymousDeviceFallback(request);
}

function anonymousDeviceFallback(request: Request): string {
  const ip = resolveAuthThrottleIp(request);
  const ua = request.get('user-agent')?.trim() || FALLBACK_FALLBACK_BUCKET;
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 40);
}
