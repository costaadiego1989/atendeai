import { Controller, Post, Body, HttpCode, Inject } from '@nestjs/common';
import { ProcessIncomingCommentUseCase } from '../../application/use-cases/ProcessIncomingCommentUseCase';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';

@Controller('social/webhook')
export class SocialWebhookController {
  constructor(
    private readonly processCommentUseCase: ProcessIncomingCommentUseCase,
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
  ) {}

  @Post('meta')
  @HttpCode(200)
  async handleMetaWebhook(@Body() body: any) {
    try {
      const entries = body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field === 'comments') {
            await this.processCommentChange(change.value);
          }
        }
      }

      return { status: 'ok' };
    } catch (err: any) {
      console.error(
        '[SocialWebhookController] Error processing Meta webhook:',
        err.message,
      );
      return { status: 'error', message: err.message };
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
}
