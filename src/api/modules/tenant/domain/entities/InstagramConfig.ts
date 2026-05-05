import { Entity } from '../../../../shared/domain/Entity.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';

export type InstagramConfigStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'INACTIVE';

interface InstagramConfigProps {
  metaAccessToken: string;
  instagramAccountId: string;
  webhookSecret: string;
  status: InstagramConfigStatus;
  configuredAt: Date;
}

export class InstagramConfig extends Entity<InstagramConfigProps> {
  private constructor(
    props: InstagramConfigProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get metaAccessToken(): string {
    return this.props.metaAccessToken;
  }

  get instagramAccountId(): string {
    return this.props.instagramAccountId;
  }

  get webhookSecret(): string {
    return this.props.webhookSecret;
  }

  get status(): InstagramConfigStatus {
    return this.props.status;
  }

  get configuredAt(): Date {
    return this.props.configuredAt;
  }

  public static create(
    props: Omit<InstagramConfigProps, 'status' | 'configuredAt'>,
    id?: UniqueEntityID,
  ): InstagramConfig {
    if (!props.metaAccessToken) {
      throw new Error('Meta access token is required');
    }
    if (!props.instagramAccountId) {
      throw new Error('Instagram account id is required');
    }
    if (!props.webhookSecret) {
      throw new Error('Instagram webhook secret is required');
    }

    return new InstagramConfig(
      {
        ...props,
        status: 'PENDING_VERIFICATION',
        configuredAt: new Date(),
      },
      id,
    );
  }

  public activate(): void {
    this.props.status = 'ACTIVE';
  }

  public static reconstitute(
    props: InstagramConfigProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): InstagramConfig {
    return new InstagramConfig(props, id, createdAt, updatedAt);
  }
}
