import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

export type SocialAccountStatus = 'ACTIVE' | 'DISCONNECTED' | 'TOKEN_EXPIRED';

interface SocialAccountProps {
  tenantId: string;
  platform: string;
  externalAccountId: string;
  username: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  pageId: string | null;
  webhookSecret: string | null;
  status: SocialAccountStatus;
  connectedAt: Date;
}

export class SocialAccount extends AggregateRoot<SocialAccountProps> {
  private constructor(props: SocialAccountProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get platform(): string { return this.props.platform; }
  get externalAccountId(): string { return this.props.externalAccountId; }
  get username(): string | null { return this.props.username; }
  get displayName(): string | null { return this.props.displayName; }
  get profilePictureUrl(): string | null { return this.props.profilePictureUrl; }
  get accessToken(): string { return this.props.accessToken; }
  get refreshToken(): string | null { return this.props.refreshToken; }
  get tokenExpiresAt(): Date | null { return this.props.tokenExpiresAt; }
  get pageId(): string | null { return this.props.pageId; }
  get webhookSecret(): string | null { return this.props.webhookSecret; }
  get status(): SocialAccountStatus { return this.props.status; }
  get connectedAt(): Date { return this.props.connectedAt; }
  get isActive(): boolean { return this.props.status === 'ACTIVE'; }
  get isTokenExpired(): boolean {
    if (!this.props.tokenExpiresAt) return false;
    return this.props.tokenExpiresAt < new Date();
  }

  static create(
    props: Omit<SocialAccountProps, 'status' | 'connectedAt'>,
    id?: UniqueEntityID,
  ): SocialAccount {
    return new SocialAccount(
      { ...props, status: 'ACTIVE', connectedAt: new Date() },
      id,
    );
  }

  static reconstitute(props: SocialAccountProps, id: UniqueEntityID): SocialAccount {
    return new SocialAccount(props, id);
  }

  disconnect(): void {
    this.props.status = 'DISCONNECTED';
  }

  markTokenExpired(): void {
    this.props.status = 'TOKEN_EXPIRED';
  }

  updateToken(accessToken: string, expiresAt: Date | null): void {
    this.props.accessToken = accessToken;
    this.props.tokenExpiresAt = expiresAt;
    this.props.status = 'ACTIVE';
  }
}
