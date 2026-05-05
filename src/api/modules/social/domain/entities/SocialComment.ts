import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export type CommentStatus = 'PENDING' | 'REPLIED' | 'IGNORED' | 'AUTO_REPLIED';
export type CommentSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'QUESTION';

interface SocialCommentProps {
  tenantId: string;
  socialAccountId: string;
  postId: string;
  platform: string;
  externalCommentId: string;
  parentCommentId: string | null;
  authorExternalId: string | null;
  authorUsername: string | null;
  authorName: string | null;
  text: string;
  sentiment: CommentSentiment | null;
  status: CommentStatus;
  isHidden: boolean;
  receivedAt: Date;
  repliedAt: Date | null;
}

export class SocialComment extends Entity<SocialCommentProps> {
  private constructor(props: SocialCommentProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get socialAccountId(): string { return this.props.socialAccountId; }
  get postId(): string { return this.props.postId; }
  get platform(): string { return this.props.platform; }
  get externalCommentId(): string { return this.props.externalCommentId; }
  get parentCommentId(): string | null { return this.props.parentCommentId; }
  get authorExternalId(): string | null { return this.props.authorExternalId; }
  get authorUsername(): string | null { return this.props.authorUsername; }
  get authorName(): string | null { return this.props.authorName; }
  get text(): string { return this.props.text; }
  get sentiment(): CommentSentiment | null { return this.props.sentiment; }
  get status(): CommentStatus { return this.props.status; }
  get isHidden(): boolean { return this.props.isHidden; }
  get receivedAt(): Date { return this.props.receivedAt; }
  get repliedAt(): Date | null { return this.props.repliedAt; }
  get isPending(): boolean { return this.props.status === 'PENDING'; }
  get isQuestion(): boolean { return this.props.sentiment === 'QUESTION'; }

  static create(
    props: Omit<SocialCommentProps, 'status' | 'isHidden' | 'receivedAt' | 'repliedAt' | 'sentiment'> & {
      sentiment?: CommentSentiment | null;
    },
    id?: UniqueEntityID,
  ): SocialComment {
    return new SocialComment(
      {
        ...props,
        sentiment: props.sentiment ?? null,
        status: 'PENDING',
        isHidden: false,
        receivedAt: new Date(),
        repliedAt: null,
      },
      id,
    );
  }

  static reconstitute(props: SocialCommentProps, id: UniqueEntityID): SocialComment {
    return new SocialComment(props, id);
  }

  markReplied(): void {
    this.props.status = 'REPLIED';
    this.props.repliedAt = new Date();
  }

  markAutoReplied(): void {
    this.props.status = 'AUTO_REPLIED';
    this.props.repliedAt = new Date();
  }

  markIgnored(): void {
    this.props.status = 'IGNORED';
  }

  hide(): void {
    this.props.isHidden = true;
  }

  setSentiment(sentiment: CommentSentiment): void {
    this.props.sentiment = sentiment;
  }
}
