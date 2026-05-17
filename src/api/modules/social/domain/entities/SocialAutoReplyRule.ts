import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export interface AutoReplyConditions {
  keywords?: string[];
  excludeKeywords?: string[];
  postIds?: string[];
  commentContainsQuestion?: boolean;
  minimumWordCount?: number;
  timeWindow?: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
}

export interface AutoReplyCommentAction {
  enabled: boolean;
  mode: 'AI_GENERATED' | 'TEMPLATE';
  aiPrompt?: string;
  templates?: string[];
  includeEmoji?: boolean;
  maxLength?: number;
}

export interface AutoReplyInboxAction {
  enabled: boolean;
  delaySeconds: number;
  mode: 'AI_GENERATED' | 'TEMPLATE';
  aiPrompt?: string;
  templates?: string[];
  mediaAttachments?: {
    type: 'IMAGE' | 'VIDEO' | 'LINK' | 'AUDIO';
    url: string;
    caption?: string;
  }[];
}

export interface AutoReplyActions {
  replyToComment: AutoReplyCommentAction;
  sendInboxMessage: AutoReplyInboxAction;
}

export interface AutoReplyLimits {
  maxRepliesPerPost: number;
  maxRepliesPerHour: number;
  cooldownPerUser: number;
}

interface SocialAutoReplyRuleProps {
  tenantId: string;
  name: string;
  isActive: boolean;
  priority: number;
  platform: string;
  conditions: AutoReplyConditions;
  actions: AutoReplyActions;
  limits: AutoReplyLimits;
  totalFired: number;
  lastFiredAt: Date | null;
}

const DEFAULT_LIMITS: AutoReplyLimits = {
  maxRepliesPerPost: 50,
  maxRepliesPerHour: 30,
  cooldownPerUser: 60,
};

const DEFAULT_ACTIONS: AutoReplyActions = {
  replyToComment: {
    enabled: true,
    mode: 'AI_GENERATED',
    includeEmoji: true,
    maxLength: 300,
  },
  sendInboxMessage: {
    enabled: false,
    delaySeconds: 30,
    mode: 'TEMPLATE',
  },
};

export class SocialAutoReplyRule extends AggregateRoot<SocialAutoReplyRuleProps> {
  private constructor(props: SocialAutoReplyRuleProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get name(): string {
    return this.props.name;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get priority(): number {
    return this.props.priority;
  }
  get platform(): string {
    return this.props.platform;
  }
  get conditions(): AutoReplyConditions {
    return this.props.conditions;
  }
  get actions(): AutoReplyActions {
    return this.props.actions;
  }
  get limits(): AutoReplyLimits {
    return this.props.limits;
  }
  get totalFired(): number {
    return this.props.totalFired;
  }
  get lastFiredAt(): Date | null {
    return this.props.lastFiredAt;
  }

  static create(
    props: Pick<SocialAutoReplyRuleProps, 'tenantId' | 'name' | 'platform'> & {
      priority?: number;
      conditions?: AutoReplyConditions;
      actions?: Partial<AutoReplyActions>;
      limits?: Partial<AutoReplyLimits>;
    },
    id?: UniqueEntityID,
  ): SocialAutoReplyRule {
    return new SocialAutoReplyRule(
      {
        tenantId: props.tenantId,
        name: props.name,
        isActive: true,
        priority: props.priority ?? 0,
        platform: props.platform,
        conditions: props.conditions ?? {},
        actions: {
          replyToComment: {
            ...DEFAULT_ACTIONS.replyToComment,
            ...props.actions?.replyToComment,
          },
          sendInboxMessage: {
            ...DEFAULT_ACTIONS.sendInboxMessage,
            ...props.actions?.sendInboxMessage,
          },
        },
        limits: { ...DEFAULT_LIMITS, ...props.limits },
        totalFired: 0,
        lastFiredAt: null,
      },
      id,
    );
  }

  static reconstitute(
    props: SocialAutoReplyRuleProps,
    id: UniqueEntityID,
  ): SocialAutoReplyRule {
    return new SocialAutoReplyRule(props, id);
  }

  activate(): void {
    this.props.isActive = true;
  }

  deactivate(): void {
    this.props.isActive = false;
  }

  toggle(): void {
    this.props.isActive = !this.props.isActive;
  }

  update(data: {
    name?: string;
    priority?: number;
    platform?: string;
    conditions?: AutoReplyConditions;
    actions?: AutoReplyActions;
    limits?: AutoReplyLimits;
  }): void {
    if (data.name !== undefined) this.props.name = data.name;
    if (data.priority !== undefined) this.props.priority = data.priority;
    if (data.platform !== undefined) this.props.platform = data.platform;
    if (data.conditions !== undefined) this.props.conditions = data.conditions;
    if (data.actions !== undefined) this.props.actions = data.actions;
    if (data.limits !== undefined) this.props.limits = data.limits;
  }

  recordFired(): void {
    this.props.totalFired += 1;
    this.props.lastFiredAt = new Date();
  }

  /**
   * Evaluates whether this rule's conditions match a given comment.
   */
  matchesComment(commentText: string, postExternalId?: string): boolean {
    const { conditions } = this.props;
    const lowerText = commentText.toLowerCase();

    // Check exclude keywords first (reject early)
    if (conditions.excludeKeywords?.length) {
      const hasExcluded = conditions.excludeKeywords.some((kw) =>
        lowerText.includes(kw.toLowerCase()),
      );
      if (hasExcluded) return false;
    }

    // Minimum word count
    if (conditions.minimumWordCount && conditions.minimumWordCount > 0) {
      const wordCount = commentText.trim().split(/\s+/).length;
      if (wordCount < conditions.minimumWordCount) return false;
    }

    // Specific post IDs filter
    if (conditions.postIds?.length && postExternalId) {
      if (!conditions.postIds.includes(postExternalId)) return false;
    }

    // Keyword matching (if keywords are set, at least one must match)
    if (conditions.keywords?.length) {
      const hasKeyword = conditions.keywords.some((kw) =>
        lowerText.includes(kw.toLowerCase()),
      );
      if (!hasKeyword) return false;
    }

    // Question detection
    if (conditions.commentContainsQuestion) {
      const questionIndicators = [
        '?',
        'quanto',
        'como',
        'qual',
        'onde',
        'quando',
        'quem',
        'por que',
        'price',
        'how much',
      ];
      const hasQuestion = questionIndicators.some((q) => lowerText.includes(q));
      if (!hasQuestion) return false;
    }

    // Time window check
    if (conditions.timeWindow) {
      const now = new Date();
      const hour = now.getHours(); // TODO: convert to timezone
      const { startHour, endHour } = conditions.timeWindow;
      if (startHour <= endHour) {
        if (hour < startHour || hour >= endHour) return false;
      } else {
        // Wraps midnight (e.g., 22-06)
        if (hour < startHour && hour >= endHour) return false;
      }
    }

    return true;
  }
}
