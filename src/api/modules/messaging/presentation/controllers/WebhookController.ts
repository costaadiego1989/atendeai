import {
  Body,
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import * as import_common from '@nestjs/common';
import { ProcessWebhookUseCase } from '../../application/use-cases/ProcessWebhookUseCase';
import { Request } from 'express';

@Controller('webhooks/whatsapp')
export class WebhookController {
  constructor(private readonly processWebhookUseCase: ProcessWebhookUseCase) { }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ) {
    try {
      const signature =
        (headers['x-hub-signature'] as string | undefined) ||
        (headers['x-twilio-signature'] as string | undefined) ||
        '';
      const forwardedProto = (headers['x-forwarded-proto'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
      const forwardedHost = (headers['x-forwarded-host'] as string | undefined)
        ?.split(',')[0]
        ?.trim();
      const protocol = forwardedProto || req.protocol;
      const host = forwardedHost || req.get('host') || '';
      const requestUrl = `${protocol}://${host}${req.originalUrl}`;

      return await this.processWebhookUseCase.execute({
        body,
        signature,
        requestUrl,
        headers,
      });
    } catch (error: any) {
      if (error.message === 'Invalid signature' || error.name === 'UnauthorizedException') {
        throw new import_common.UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
