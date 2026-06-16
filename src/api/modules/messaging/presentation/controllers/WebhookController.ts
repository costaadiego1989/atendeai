import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Post,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import * as import_common from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessWebhookUseCase } from '../../application/use-cases/ProcessWebhookUseCase';
import { META_WHATSAPP_RAW_BODY_HEADER } from '../../infrastructure/acl/WhatsAppCloudApiAdapter';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';

@Controller('webhooks/whatsapp')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @SkipSuccessEnvelope()
  verifyChallenge(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expectedToken = this.configService.get<string>(
      'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    );

    if (
      mode === 'subscribe' &&
      !!expectedToken &&
      verifyToken === expectedToken &&
      challenge
    ) {
      return challenge;
    }

    throw new ForbiddenException('Webhook verification failed');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      const signature =
        (headers['x-hub-signature-256'] as string | undefined) ||
        (headers['x-hub-signature'] as string | undefined) ||
        (headers['x-twilio-signature'] as string | undefined) ||
        '';
      const forwardedProto = (
        headers['x-forwarded-proto'] as string | undefined
      )
        ?.split(',')[0]
        ?.trim();
      const forwardedHost = (headers['x-forwarded-host'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
      const protocol = forwardedProto || req.protocol;
      const host = forwardedHost || req.get('host') || '';
      const requestUrl = `${protocol}://${host}${req.originalUrl}`;

      const rawBody = req.rawBody?.toString('utf8');
      if (!rawBody && headers['x-hub-signature-256']) {
        this.logger.warn(
          'META_CLOUD webhook: x-hub-signature-256 present but req.rawBody is undefined — ' +
            'ensure rawBody:true is set in NestFactory.create options.',
        );
      }
      const headersWithRawBody = rawBody
        ? { ...headers, [META_WHATSAPP_RAW_BODY_HEADER]: rawBody }
        : headers;

      return await this.processWebhookUseCase.execute({
        body,
        signature,
        requestUrl,
        headers: headersWithRawBody,
      });
    } catch (error: any) {
      if (
        error.message === 'Invalid signature' ||
        error.name === 'UnauthorizedException'
      ) {
        throw new import_common.UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
