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
export class MetaInstagramOAuthStateService {
  constructor(private readonly configService: ConfigService) {}

  sign(tenantId: string, branchId?: string | null): string {
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
        'Meta Instagram OAuth state is invalid',
      );
    }

    const expectedSignature = this.signValue(encoded);
    if (
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new ValidationErrorException(
        'Meta Instagram OAuth state is invalid',
      );
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8'),
    ) as StatePayload;

    if (!payload.tenantId || !payload.issuedAt) {
      throw new ValidationErrorException(
        'Meta Instagram OAuth state is invalid',
      );
    }

    if (Date.now() - payload.issuedAt > 15 * 60 * 1000) {
      throw new ValidationErrorException('Meta Instagram OAuth state expired');
    }

    return payload;
  }

  private signValue(value: string): string {
    const secret =
      this.configService.get<string>('META_INSTAGRAM_STATE_SECRET') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'atendeai-meta-instagram-state';

    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
