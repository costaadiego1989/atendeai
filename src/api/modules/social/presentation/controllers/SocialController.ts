import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { ListSocialCommentsUseCase } from '../../application/use-cases/ListSocialCommentsUseCase';
import { ReplyToCommentUseCase } from '../../application/use-cases/ReplyToCommentUseCase';
import { ConfigureAutoReplyRulesUseCase } from '../../application/use-cases/ConfigureAutoReplyRulesUseCase';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import { SocialAccount } from '../../domain/entities/SocialAccount';
import {
  ISocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from '../../domain/ports/ISocialPlatformAdapter';
import {
  ListCommentsQueryDTO,
  ReplyToCommentDTO,
  CreateAutoReplyRuleDTO,
  UpdateAutoReplyRuleDTO,
  SendInboxMessageDTO,
  ConnectInstagramDTO,
} from '../dtos/SocialDTOs';
import { Inject } from '@nestjs/common';

@Controller('tenants/:tenantId/social')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class SocialController {
  constructor(
    private readonly listCommentsUseCase: ListSocialCommentsUseCase,
    private readonly replyToCommentUseCase: ReplyToCommentUseCase,
    private readonly configureRulesUseCase: ConfigureAutoReplyRulesUseCase,
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    @Inject(SOCIAL_PLATFORM_ADAPTER)
    private readonly adapter: ISocialPlatformAdapter,
  ) {}

  @Get('accounts')
  @Roles('OWNER', 'ADMIN')
  async listAccounts(@Param('tenantId') tenantId: string) {
    const accounts = await this.repo.listAccounts(tenantId);
    return accounts.map((a) => ({
      id: a.id.toValue(),
      platform: a.platform,
      username: a.username,
      displayName: a.displayName,
      profilePictureUrl: a.profilePictureUrl,
      status: a.status,
      connectedAt: a.connectedAt,
    }));
  }

  @Post('accounts/instagram/connect')
  @Roles('OWNER', 'ADMIN')
  async connectInstagram(
    @Param('tenantId') tenantId: string,
    @Body() body: ConnectInstagramDTO,
  ) {
    const account = SocialAccount.create({
      tenantId,
      platform: 'INSTAGRAM',
      externalAccountId: body.instagramAccountId,
      username: body.username || null,
      displayName: body.displayName || null,
      profilePictureUrl: body.profilePictureUrl || null,
      accessToken: body.code,
      refreshToken: null,
      tokenExpiresAt: null,
      pageId: body.pageId || null,
      webhookSecret: null,
    });

    await this.repo.saveAccount(account);
    await this.repo.logAudit(tenantId, {
      event: 'ACCOUNT_CONNECTED',
      entityId: account.id.toValue(),
      entityType: 'ACCOUNT',
      platform: 'INSTAGRAM',
      metadata: { username: body.username },
    });

    return { id: account.id.toValue(), status: 'ACTIVE' };
  }

  @Delete('accounts/:id')
  @Roles('OWNER', 'ADMIN')
  async disconnectAccount(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.repo.deleteAccount(tenantId, id);
    await this.repo.logAudit(tenantId, {
      event: 'ACCOUNT_DISCONNECTED',
      entityId: id,
      entityType: 'ACCOUNT',
    });
    return { success: true };
  }

  @Get('comments')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async listComments(
    @Param('tenantId') tenantId: string,
    @Query() query: ListCommentsQueryDTO,
  ) {
    const result = await this.listCommentsUseCase.execute({
      tenantId,
      ...query,
    });

    return {
      data: result.comments.map((c) => ({
        id: c.id.toValue(),
        platform: c.platform,
        postId: c.postId,
        externalCommentId: c.externalCommentId,
        authorUsername: c.authorUsername,
        authorName: c.authorName,
        text: c.text,
        sentiment: c.sentiment,
        status: c.status,
        isHidden: c.isHidden,
        receivedAt: c.receivedAt,
        repliedAt: c.repliedAt,
      })),
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  @Get('comments/:id/thread')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getCommentThread(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    const comment = await this.repo.findCommentById(tenantId, id);
    if (!comment) return { error: 'Comentário não encontrado' };

    const replies = await this.repo.listReplies(tenantId, id);

    return {
      comment: {
        id: comment.id.toValue(),
        authorUsername: comment.authorUsername,
        text: comment.text,
        status: comment.status,
        receivedAt: comment.receivedAt,
      },
      replies,
    };
  }

  @Post('comments/:id/reply')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async replyToComment(
    @Param('tenantId') tenantId: string,
    @Param('id') commentId: string,
    @Body() body: ReplyToCommentDTO,
    @Req() req: any,
  ) {
    return this.replyToCommentUseCase.execute({
      tenantId,
      commentId,
      text: body.text,
      userId: req.user?.userId,
    });
  }

  @Post('inbox/send')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async sendInboxMessage(
    @Param('tenantId') tenantId: string,
    @Body() body: SendInboxMessageDTO,
  ) {
    const account = await this.repo.findAccountById(
      tenantId,
      body.socialAccountId,
    );
    if (!account || !account.isActive) {
      return {
        success: false,
        error: 'Conta social não encontrada ou desconectada',
      };
    }

    const result = await this.adapter.sendInboxMessage(
      account.accessToken,
      body.recipientExternalId,
      {
        text: body.text,
        imageUrl: body.imageUrl,
        videoUrl: body.videoUrl,
        linkUrl: body.linkUrl,
        linkTitle: body.linkTitle,
      },
    );

    if (result.success) {
      await this.repo.upsertInboxThread(tenantId, {
        socialAccountId: body.socialAccountId,
        platform: account.platform,
        recipientExternalId: body.recipientExternalId,
        recipientUsername: body.recipientUsername,
        originCommentId: body.originCommentId,
        lastMessageText: body.text || '[media]',
      });

      await this.repo.logAudit(tenantId, {
        event: 'INBOX_MESSAGE_SENT',
        entityType: 'INBOX_THREAD',
        platform: account.platform,
        metadata: { recipientUsername: body.recipientUsername },
      });
    }

    return result;
  }

  @Get('rules')
  @Roles('OWNER', 'ADMIN')
  async listRules(@Param('tenantId') tenantId: string) {
    const rules = await this.configureRulesUseCase.list(tenantId);
    return rules.map((r) => ({
      id: r.id.toValue(),
      name: r.name,
      isActive: r.isActive,
      priority: r.priority,
      platform: r.platform,
      conditions: r.conditions,
      actions: r.actions,
      limits: r.limits,
      totalFired: r.totalFired,
      lastFiredAt: r.lastFiredAt,
      createdAt: r.createdAt,
    }));
  }

  @Post('rules')
  @Roles('OWNER', 'ADMIN')
  async createRule(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateAutoReplyRuleDTO,
  ) {
    return this.configureRulesUseCase.create({ tenantId, ...body });
  }

  @Put('rules/:id')
  @Roles('OWNER', 'ADMIN')
  async updateRule(
    @Param('tenantId') tenantId: string,
    @Param('id') ruleId: string,
    @Body() body: UpdateAutoReplyRuleDTO,
  ) {
    return this.configureRulesUseCase.update({ tenantId, ruleId, ...body });
  }

  @Patch('rules/:id/toggle')
  @Roles('OWNER', 'ADMIN')
  async toggleRule(
    @Param('tenantId') tenantId: string,
    @Param('id') ruleId: string,
  ) {
    return this.configureRulesUseCase.toggle(tenantId, ruleId);
  }

  @Delete('rules/:id')
  @Roles('OWNER', 'ADMIN')
  async deleteRule(
    @Param('tenantId') tenantId: string,
    @Param('id') ruleId: string,
  ) {
    return this.configureRulesUseCase.delete(tenantId, ruleId);
  }

  @Get('stats')
  @Roles('OWNER', 'ADMIN')
  async getStats(@Param('tenantId') tenantId: string) {
    return this.repo.getStats(tenantId);
  }
}
