import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  Inject,
  ForbiddenException,
  RawBodyRequest,
  Req,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { ProcessIncomingCommentUseCase } from '../../application/use-cases/ProcessIncomingCommentUseCase';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';

@Controller('social/webhook')
export class SocialWebhookController {
  private readonly logger = new Logger(SocialWebhookController.name);

  constructor(
    private readonly processCommentUseCase: ProcessIncomingCommentUseCase,
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    private readonly configService: ConfigService,
  ) {}

  @Get('meta')
  @HttpCode(200)
  @SkipSuccessEnvelope()
  verifyMetaWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get<string>(
      'META_WEBHOOK_VERIFY_TOKEN',
    );

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Meta webhook verification succeeded');
      return challenge;
    }

    this.logger.warn('Meta webhook verification failed: token mismatch');
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post('meta')
  @HttpCode(200)
  async handleMetaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
  ) {
    this.verifyWebhookSignature(req);

    try {
      const entries = body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field === 'comments') {
            await this.processCommentChange(change.value);
          } else if (change.field === 'messages') {
            await this.processMessageChange(change.value, entry.id);
          }
        }
      }

      return { status: 'ok' };
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      this.logger.error(
        `Error processing Meta webhook: ${err.message}`,
        err.stack,
      );
      return { status: 'error', message: err.message };
    }
  }

  private verifyWebhookSignature(req: RawBodyRequest<Request>): void {
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    if (!appSecret) {
      this.logger.error('META_APP_SECRET not configured — blocking webhook');
      throw new ForbiddenException('META_APP_SECRET not configured');
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!signature) {
      throw new ForbiddenException('Missing X-Hub-Signature-256 header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new ForbiddenException(
        'Raw body not available for signature verification',
      );
    }

    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn('Meta webhook signature verification failed');
      throw new ForbiddenException('Invalid webhook signature');
    }
  }

  private async processCommentChange(value: any) {
    if (!value?.id || !value?.text || !value?.media?.id) {
      return;
    }

    const instagramAccountId = value?.media?.owner?.id;
    if (!instagramAccountId) return;
    // Procura a conta por tenant para processar o webhook sem exigir ENV Meta.
    // Como a API já é multi-tenant, iteramos sobre contas conhecidas no schema social.
    const tenants = await this.repo.listKnownTenantsByPlatform(
      'INSTAGRAM',
      instagramAccountId,
    );
    if (!tenants?.length) {
      return;
    }

    for (const tenantEntry of tenants) {
      const account = await this.repo.findAccountByPlatform(
        tenantEntry.tenantId,
        'INSTAGRAM',
        instagramAccountId,
      );
      if (!account) continue;

      await this.processCommentUseCase.execute({
        tenantId: tenantEntry.tenantId,
        socialAccountId: account.id.toValue(),
        platform: 'INSTAGRAM',
        externalPostId: value.media.id,
        externalCommentId: value.id,
        parentCommentId: value.parent_id ?? undefined,
        authorExternalId: value.from?.id ?? '',
        authorUsername: value.from?.username ?? value.from?.name ?? 'usuario',
        authorName: value.from?.name ?? null,
        text: value.text,
        accessToken: account.accessToken,
      });
    }
  }

  private async processMessageChange(
    value: any,
    pageId: string,
  ): Promise<void> {
    if (!value?.sender?.id || !value?.message) {
      return;
    }

    const senderId = value.sender.id;
    const messageText = value.message.text || '';
    const messageId = value.message.mid;

    if (!messageText && !value.message.attachments?.length) {
      return;
    }

    const tenants = await this.repo.listKnownTenantsByPlatform(
      'INSTAGRAM',
      pageId,
    );
    if (!tenants?.length) {
      return;
    }

    for (const tenantEntry of tenants) {
      const account = await this.repo.findAccountByPlatform(
        tenantEntry.tenantId,
        'INSTAGRAM',
        pageId,
      );
      if (!account) continue;

      await this.repo.upsertInboxThread(tenantEntry.tenantId, {
        socialAccountId: account.id.toValue(),
        platform: 'INSTAGRAM',
        recipientExternalId: senderId,
        recipientUsername: value.sender?.username,
        lastMessageText: messageText || '[attachment]',
      });

      await this.repo.logAudit(tenantEntry.tenantId, {
        event: 'DM_RECEIVED',
        entityType: 'INBOX_THREAD',
        platform: 'INSTAGRAM',
        metadata: {
          senderId,
          messageId,
          hasAttachments: !!value.message.attachments?.length,
        },
      });

      this.logger.debug(
        `DM received from ${senderId} for tenant ${tenantEntry.tenantId}`,
      );
    }
  }
}
