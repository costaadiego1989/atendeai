import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

interface StatePayload {
  tenantId: string;
  branchId?: string;
  issuedAt: number;
}

@Injectable()
export class GoogleCalendarOAuthStateService {
  constructor(private readonly configService: ConfigService) {}

  sign(scope: string): string {
    const [tenantId, branchId] = scope.split(':');
    const payload: StatePayload = {
      tenantId,
      branchId: branchId || undefined,
      issuedAt: Date.now(),
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
      'base64url',
    );
    const signature = this.signValue(encoded);
    return `${encoded}.${signature}`;
  }

  verify(state: string): StatePayload {
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) {
      throw new ValidationErrorException(
        'Google Calendar OAuth state is invalid',
      );
    }

    const expectedSignature = this.signValue(encoded);
    if (
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new ValidationErrorException(
        'Google Calendar OAuth state is invalid',
      );
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8'),
    ) as StatePayload;

    if (!payload.tenantId || !payload.issuedAt) {
      throw new ValidationErrorException(
        'Google Calendar OAuth state is invalid',
      );
    }

    if (Date.now() - payload.issuedAt > 15 * 60 * 1000) {
      throw new ValidationErrorException('Google Calendar OAuth state expired');
    }

    return payload;
  }

  private signValue(value: string): string {
    const secret =
      this.configService.get<string>('GOOGLE_CALENDAR_STATE_SECRET') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'atendeai-google-calendar-state';

    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
