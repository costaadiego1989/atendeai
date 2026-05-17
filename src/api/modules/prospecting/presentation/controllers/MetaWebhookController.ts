import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IHandleMetaQualityEventUseCase } from '../../application/use-cases/interfaces/IHandleMetaQualityEventUseCase';

@Controller('meta/webhook')
export class MetaWebhookController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(IHandleMetaQualityEventUseCase)
    private readonly handleMetaQualityEventUseCase: IHandleMetaQualityEventUseCase,
  ) {}

  @Get()
  verifyChallenge(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get<string>(
      'META_WEBHOOK_VERIFY_TOKEN',
    );
    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ status: string }> {
    this.validateSignature(body, signature);

    const phones = this.extractOptOutPhones(body);

    await Promise.all(
      phones.map((phone) =>
        this.handleMetaQualityEventUseCase.execute({ phone }).catch(() => {}),
      ),
    );

    return { status: 'ok' };
  }

  private validateSignature(
    body: Record<string, unknown>,
    signature: string,
  ): void {
    const secret = this.configService.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) return;

    if (!signature?.startsWith('sha256=')) {
      throw new ForbiddenException('Missing or invalid webhook signature');
    }

    const hmac = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const expected = Buffer.from(`sha256=${hmac}`);
    const received = Buffer.from(signature);

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new ForbiddenException('Webhook signature mismatch');
    }
  }

  private extractOptOutPhones(body: Record<string, unknown>): string[] {
    const phones: string[] = [];
    const entries = (body as any)?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};

        for (const contact of value?.contacts ?? []) {
          const waId = contact?.wa_id;
          if (waId) phones.push(waId);
        }
      }
    }

    return phones;
  }
}
