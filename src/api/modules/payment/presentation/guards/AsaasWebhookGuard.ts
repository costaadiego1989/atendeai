import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AsaasWebhookGuard implements CanActivate {
  private readonly logger = new Logger(AsaasWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['asaas-api-signature'];
    const secret = this.configService.get<string>('ASAAS_WEBHOOK_SECRET');

    if (!secret) {
      this.logger.error('ASAAS_WEBHOOK_SECRET is not configured');
      throw new ForbiddenException('Webhook configuration error');
    }

    if (!signature) {
      this.logger.warn('Asaas webhook signature missing');
      throw new ForbiddenException('Invalid signature');
    }

    const rawBody: Buffer | string | undefined = request.rawBody;
    const body = rawBody
      ? typeof rawBody === 'string'
        ? rawBody
        : rawBody.toString('utf8')
      : JSON.stringify(request.body);

    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const isValid =
      sigBuffer.byteLength === hashBuffer.byteLength &&
      crypto.timingSafeEqual(sigBuffer, hashBuffer);
    if (!isValid) {
      this.logger.error(
        `Invalid Asaas webhook signature. Received: ${signature}`,
      );
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
