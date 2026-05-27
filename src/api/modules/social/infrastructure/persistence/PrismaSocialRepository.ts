import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ISocialRepository } from '../../domain/ports/ISocialRepository';
import { SocialAccount } from '../../domain/entities/SocialAccount';
import { SocialComment } from '../../domain/entities/SocialComment';
import { SocialAutoReplyRule } from '../../domain/entities/SocialAutoReplyRule';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

@Injectable()
export class PrismaSocialRepository implements ISocialRepository {
  constructor(private readonly prisma: PrismaService) {}
  async saveAccount(account: SocialAccount): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO social_schema.social_accounts
        (id, tenant_id, platform, external_account_id, username, display_name, profile_picture_url,
         access_token, refresh_token, token_expires_at, page_id, webhook_secret, status, connected_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (tenant_id, platform, external_account_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         profile_picture_url = EXCLUDED.profile_picture_url,
         page_id = EXCLUDED.page_id,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      account.id.toValue(),
      account.tenantId,
      account.platform,
      account.externalAccountId,
      account.username,
      account.displayName,
      account.profilePictureUrl,
      account.accessToken,
      account.refreshToken,
      account.tokenExpiresAt,
      account.pageId,
      account.webhookSecret,
      account.status,
      account.connectedAt,
    );
  }

  async findAccountById(
    tenantId: string,
    id: string,
  ): Promise<SocialAccount | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_accounts WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async findAccountByPlatform(
    tenantId: string,
    platform: string,
    externalAccountId: string,
  ): Promise<SocialAccount | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_accounts WHERE tenant_id = $1 AND platform = $2 AND external_account_id = $3`,
      tenantId,
      platform,
      externalAccountId,
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async listKnownTenantsByPlatform(
    platform: string,
    externalAccountId: string,
  ): Promise<Array<{ tenantId: string }>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ tenant_id: string }>
    >(
      `SELECT tenant_id FROM social_schema.social_accounts WHERE platform = $1 AND external_account_id = $2`,
      platform,
      externalAccountId,
    );
    return rows.map((row) => ({ tenantId: row.tenant_id }));
  }

  async listAccounts(tenantId: string): Promise<SocialAccount[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_accounts WHERE tenant_id = $1 ORDER BY connected_at DESC`,
      tenantId,
    );
    return rows.map((r) => this.mapAccount(r));
  }

  async deleteAccount(tenantId: string, id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM social_schema.social_accounts WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async upsertPost(
    tenantId: string,
    post: {
      socialAccountId: string;
      platform: string;
      externalPostId: string;
      postType?: string;
      caption?: string;
      mediaUrl?: string;
      permalink?: string;
      postedAt?: Date;
    },
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO social_schema.social_posts
        (id, tenant_id, social_account_id, platform, external_post_id, post_type, caption, media_url, permalink, posted_at, discovered_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (tenant_id, external_post_id) DO UPDATE SET
         comment_count = social_posts.comment_count,
         caption = COALESCE(EXCLUDED.caption, social_posts.caption)
       RETURNING id`,
      tenantId,
      post.socialAccountId,
      post.platform,
      post.externalPostId,
      post.postType || null,
      post.caption || null,
      post.mediaUrl || null,
      post.permalink || null,
      post.postedAt || null,
    );
    return rows[0]?.id;
  }

  async saveComment(comment: SocialComment): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO social_schema.social_comments
        (id, tenant_id, social_account_id, post_id, platform, external_comment_id, parent_comment_id,
         author_external_id, author_username, author_name, text, sentiment, status, is_hidden, received_at, replied_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (tenant_id, external_comment_id) DO NOTHING`,
      comment.id.toValue(),
      comment.tenantId,
      comment.socialAccountId,
      comment.postId,
      comment.platform,
      comment.externalCommentId,
      comment.parentCommentId,
      comment.authorExternalId,
      comment.authorUsername,
      comment.authorName,
      comment.text,
      comment.sentiment,
      comment.status,
      comment.isHidden,
      comment.receivedAt,
      comment.repliedAt,
    );
  }

  async findCommentById(
    tenantId: string,
    id: string,
  ): Promise<SocialComment | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_comments WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
    return rows[0] ? this.mapComment(rows[0]) : null;
  }

  async findCommentByExternalId(
    tenantId: string,
    externalCommentId: string,
  ): Promise<SocialComment | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_comments WHERE tenant_id = $1 AND external_comment_id = $2`,
      tenantId,
      externalCommentId,
    );
    return rows[0] ? this.mapComment(rows[0]) : null;
  }

  async listComments(
    tenantId: string,
    filters: {
      status?: string;
      postId?: string;
      platform?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ comments: SocialComment[]; total: number }> {
    const conditions = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`status = $${idx}`);
      params.push(filters.status);
      idx++;
    }
    if (filters.postId) {
      conditions.push(`post_id = $${idx}`);
      params.push(filters.postId);
      idx++;
    }
    if (filters.platform) {
      conditions.push(`platform = $${idx}`);
      params.push(filters.platform);
      idx++;
    }

    const where = conditions.join(' AND ');
    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM social_schema.social_comments WHERE ${where} ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as count FROM social_schema.social_comments WHERE ${where}`,
        ...params,
      ),
    ]);

    return {
      comments: rows.map((r) => this.mapComment(r)),
      total: countRows[0]?.count || 0,
    };
  }

  async updateCommentStatus(
    tenantId: string,
    commentId: string,
    status: string,
    repliedAt?: Date,
  ): Promise<void> {
    if (repliedAt) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE social_schema.social_comments SET status = $1, replied_at = $2 WHERE id = $3 AND tenant_id = $4`,
        status,
        repliedAt,
        commentId,
        tenantId,
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `UPDATE social_schema.social_comments SET status = $1 WHERE id = $2 AND tenant_id = $3`,
        status,
        commentId,
        tenantId,
      );
    }
  }

  async saveReply(
    tenantId: string,
    reply: {
      commentId: string;
      externalReplyId?: string;
      text: string;
      repliedBy: 'AI' | 'HUMAN';
      ruleId?: string;
      userId?: string;
      status: string;
      errorMessage?: string;
    },
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO social_schema.social_comment_replies
        (id, tenant_id, comment_id, external_reply_id, text, replied_by, rule_id, user_id, status, error_message, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      tenantId,
      reply.commentId,
      reply.externalReplyId || null,
      reply.text,
      reply.repliedBy,
      reply.ruleId || null,
      reply.userId || null,
      reply.status,
      reply.errorMessage || null,
    );
    return rows[0]?.id;
  }

  async listReplies(
    tenantId: string,
    commentId: string,
  ): Promise<
    Array<{
      id: string;
      text: string;
      repliedBy: string;
      ruleId?: string;
      status: string;
      createdAt: Date;
    }>
  > {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, text, replied_by, rule_id, status, created_at FROM social_schema.social_comment_replies
       WHERE tenant_id = $1 AND comment_id = $2 ORDER BY created_at ASC`,
      tenantId,
      commentId,
    );
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      repliedBy: r.replied_by,
      ruleId: r.rule_id,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  async saveRule(rule: SocialAutoReplyRule): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO social_schema.social_auto_reply_rules
        (id, tenant_id, name, is_active, priority, platform, conditions, actions, limits, total_fired, last_fired_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         is_active = EXCLUDED.is_active,
         priority = EXCLUDED.priority,
         platform = EXCLUDED.platform,
         conditions = EXCLUDED.conditions,
         actions = EXCLUDED.actions,
         limits = EXCLUDED.limits,
         updated_at = NOW()`,
      rule.id.toValue(),
      rule.tenantId,
      rule.name,
      rule.isActive,
      rule.priority,
      rule.platform,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      JSON.stringify(rule.limits),
      rule.totalFired,
      rule.lastFiredAt,
    );
  }

  async findRuleById(
    tenantId: string,
    id: string,
  ): Promise<SocialAutoReplyRule | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_auto_reply_rules WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
    return rows[0] ? this.mapRule(rows[0]) : null;
  }

  async listActiveRules(
    tenantId: string,
    platform?: string,
  ): Promise<SocialAutoReplyRule[]> {
    const query = platform
      ? `SELECT * FROM social_schema.social_auto_reply_rules WHERE tenant_id = $1 AND is_active = true AND (platform = $2 OR platform = 'ALL') ORDER BY priority DESC`
      : `SELECT * FROM social_schema.social_auto_reply_rules WHERE tenant_id = $1 AND is_active = true ORDER BY priority DESC`;

    const rows = platform
      ? await this.prisma.$queryRawUnsafe<any[]>(query, tenantId, platform)
      : await this.prisma.$queryRawUnsafe<any[]>(query, tenantId);

    return rows.map((r) => this.mapRule(r));
  }

  async listAllRules(tenantId: string): Promise<SocialAutoReplyRule[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_auto_reply_rules WHERE tenant_id = $1 ORDER BY priority DESC, created_at DESC`,
      tenantId,
    );
    return rows.map((r) => this.mapRule(r));
  }

  async deleteRule(tenantId: string, id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM social_schema.social_auto_reply_rules WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async incrementRuleFired(tenantId: string, ruleId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE social_schema.social_auto_reply_rules SET total_fired = total_fired + 1, last_fired_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      ruleId,
      tenantId,
    );
  }

  async countRepliesByRuleInLastHour(
    tenantId: string,
    ruleId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as count FROM social_schema.social_comment_replies
       WHERE tenant_id = $1 AND rule_id = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
      tenantId,
      ruleId,
    );
    return rows[0]?.count || 0;
  }

  async countRepliesForPostByRule(
    tenantId: string,
    ruleId: string,
    postId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as count FROM social_schema.social_comment_replies r
       JOIN social_schema.social_comments c ON r.comment_id = c.id
       WHERE r.tenant_id = $1 AND r.rule_id = $2 AND c.post_id = $3`,
      tenantId,
      ruleId,
      postId,
    );
    return rows[0]?.count || 0;
  }

  async findLastReplyToUser(
    tenantId: string,
    ruleId: string,
    authorExternalId: string,
  ): Promise<Date | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.created_at FROM social_schema.social_comment_replies r
       JOIN social_schema.social_comments c ON r.comment_id = c.id
       WHERE r.tenant_id = $1 AND r.rule_id = $2 AND c.author_external_id = $3
       ORDER BY r.created_at DESC LIMIT 1`,
      tenantId,
      ruleId,
      authorExternalId,
    );
    return rows[0]?.created_at || null;
  }

  async upsertInboxThread(
    tenantId: string,
    thread: {
      socialAccountId: string;
      platform: string;
      recipientExternalId: string;
      recipientUsername?: string;
      originCommentId?: string;
      lastMessageText: string;
    },
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO social_schema.social_inbox_threads
        (id, tenant_id, social_account_id, platform, recipient_external_id, recipient_username,
         origin_comment_id, last_message_text, last_message_at, message_count, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 1, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (tenant_id, platform, recipient_external_id) DO UPDATE SET
         last_message_text = EXCLUDED.last_message_text,
         last_message_at = NOW(),
         message_count = social_inbox_threads.message_count + 1,
         updated_at = NOW()
       RETURNING id`,
      tenantId,
      thread.socialAccountId,
      thread.platform,
      thread.recipientExternalId,
      thread.recipientUsername || null,
      thread.originCommentId || null,
      thread.lastMessageText,
    );
    return rows[0]?.id;
  }

  async logAudit(
    tenantId: string,
    entry: {
      event: string;
      entityId?: string;
      entityType?: string;
      platform?: string;
      ruleId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO social_schema.social_audit_log
        (id, tenant_id, event, entity_id, entity_type, platform, rule_id, metadata, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
      tenantId,
      entry.event,
      entry.entityId || null,
      entry.entityType || null,
      entry.platform || null,
      entry.ruleId || null,
      JSON.stringify(entry.metadata || {}),
    );
  }

  async getStats(tenantId: string): Promise<{
    totalComments: number;
    pendingComments: number;
    repliedComments: number;
    autoRepliedComments: number;
    activeRules: number;
    connectedAccounts: number;
  }> {
    const [comments, rules, accounts] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending,
          COUNT(*) FILTER (WHERE status = 'REPLIED')::int as replied,
          COUNT(*) FILTER (WHERE status = 'AUTO_REPLIED')::int as auto_replied
         FROM social_schema.social_comments WHERE tenant_id = $1`,
        tenantId,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as count FROM social_schema.social_auto_reply_rules WHERE tenant_id = $1 AND is_active = true`,
        tenantId,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as count FROM social_schema.social_accounts WHERE tenant_id = $1 AND status = 'ACTIVE'`,
        tenantId,
      ),
    ]);

    return {
      totalComments: comments[0]?.total || 0,
      pendingComments: comments[0]?.pending || 0,
      repliedComments: comments[0]?.replied || 0,
      autoRepliedComments: comments[0]?.auto_replied || 0,
      activeRules: rules[0]?.count || 0,
      connectedAccounts: accounts[0]?.count || 0,
    };
  }

  async listAccountsWithExpiringTokens(
    daysUntilExpiry: number,
  ): Promise<SocialAccount[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM social_schema.social_accounts
       WHERE status = 'ACTIVE'
         AND token_expires_at IS NOT NULL
         AND token_expires_at < NOW() + INTERVAL '${daysUntilExpiry} days'
         AND token_expires_at > NOW()`,
    );
    return rows.map((r) => this.mapAccount(r));
  }

  async updateAccountToken(
    tenantId: string,
    accountId: string,
    accessToken: string,
    tokenExpiresAt: Date,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE social_schema.social_accounts
       SET access_token = $1, token_expires_at = $2, status = 'ACTIVE', updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      accessToken,
      tokenExpiresAt,
      accountId,
      tenantId,
    );
  }

  private mapAccount(raw: any): SocialAccount {
    return SocialAccount.reconstitute(
      {
        tenantId: raw.tenant_id,
        platform: raw.platform,
        externalAccountId: raw.external_account_id,
        username: raw.username,
        displayName: raw.display_name,
        profilePictureUrl: raw.profile_picture_url,
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        tokenExpiresAt: raw.token_expires_at,
        pageId: raw.page_id,
        webhookSecret: raw.webhook_secret,
        status: raw.status,
        connectedAt: raw.connected_at,
      },
      new UniqueEntityID(raw.id),
    );
  }

  private mapComment(raw: any): SocialComment {
    return SocialComment.reconstitute(
      {
        tenantId: raw.tenant_id,
        socialAccountId: raw.social_account_id,
        postId: raw.post_id,
        platform: raw.platform,
        externalCommentId: raw.external_comment_id,
        parentCommentId: raw.parent_comment_id,
        authorExternalId: raw.author_external_id,
        authorUsername: raw.author_username,
        authorName: raw.author_name,
        text: raw.text,
        sentiment: raw.sentiment,
        status: raw.status,
        isHidden: raw.is_hidden,
        receivedAt: raw.received_at,
        repliedAt: raw.replied_at,
      },
      new UniqueEntityID(raw.id),
    );
  }

  private mapRule(raw: any): SocialAutoReplyRule {
    return SocialAutoReplyRule.reconstitute(
      {
        tenantId: raw.tenant_id,
        name: raw.name,
        isActive: raw.is_active,
        priority: raw.priority,
        platform: raw.platform,
        conditions:
          typeof raw.conditions === 'string'
            ? JSON.parse(raw.conditions)
            : raw.conditions || {},
        actions:
          typeof raw.actions === 'string'
            ? JSON.parse(raw.actions)
            : raw.actions || {},
        limits:
          typeof raw.limits === 'string'
            ? JSON.parse(raw.limits)
            : raw.limits || {},
        totalFired: raw.total_fired,
        lastFiredAt: raw.last_fired_at,
      },
      new UniqueEntityID(raw.id),
    );
  }
}
