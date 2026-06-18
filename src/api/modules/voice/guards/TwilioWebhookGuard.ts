/**
 * TwilioWebhookGuard
 *
 * Validates the X-Twilio-Signature header on incoming webhook requests.
 * Twilio signs every request it makes to your webhook URL using HMAC-SHA1.
 *
 * Algorithm (https://www.twilio.com/docs/usage/security#validating-signatures-from-twilio):
 *   1. Take the full URL of the webhook (including query string if any).
 *   2. Sort all POST parameters alphabetically by name.
 *   3. Iterate through the sorted list of POST parameters, and append the
 *      variable name and value (with no delimiters) to the URL string.
 *   4. Sign the resulting string with HMAC-SHA1 using your AuthToken as the key.
 *   5. Base64 encode the resulting hash.
 *   6. Compare with the X-Twilio-Signature header value.
 *
 * Requires env var: TWILIO_AUTH_TOKEN
 * Requires NestFactory rawBody: true (already set in main.ts).
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TwilioWebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      this.logger.error(
        'TWILIO_AUTH_TOKEN is not set — cannot validate Twilio webhook signature',
      );
      throw new ForbiddenException(
        'Webhook signature validation misconfigured',
      );
    }

    const signature =
      (req.headers['x-twilio-signature'] as string | undefined) ?? '';

    if (!signature) {
      this.logger.warn(
        'Twilio webhook request missing X-Twilio-Signature header',
      );
      throw new ForbiddenException('Missing Twilio signature');
    }

    const url = this.reconstructUrl(req);
    const params: Record<string, string> =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, string>)
        : {};

    const expected = this.computeSignature(authToken, url, params);

    if (!this.timingSafeEqual(expected, signature)) {
      this.logger.warn(`Twilio signature mismatch for ${req.method} ${url}`);
      throw new ForbiddenException('Invalid Twilio signature');
    }

    return true;
  }

  /**
   * Reconstruct the full public URL that Twilio used when making the request.
   * In production this must match exactly what Twilio has on record.
   * We use the Host header + originalUrl (NestJS preserves path + query).
   */
  private reconstructUrl(req: Request): string {
    const proto = req.protocol ?? 'https';
    const host = req.get('host') ?? '';
    return `${proto}://${host}${req.originalUrl}`;
  }

  /**
   * Compute HMAC-SHA1 signature per Twilio spec.
   */
  private computeSignature(
    authToken: string,
    url: string,
    params: Record<string, string>,
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], '');

    const data = url + sortedParams;
    return crypto.createHmac('sha1', authToken).update(data).digest('base64');
  }

  /**
   * Timing-safe comparison to prevent timing attacks.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do a dummy comparison to avoid timing leak on length
      crypto.timingSafeEqual(
        Buffer.from(a, 'base64'),
        Buffer.from(a, 'base64'),
      );
      return false;
    }
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'base64'),
        Buffer.from(b, 'base64'),
      );
    } catch {
      return false;
    }
  }
}
