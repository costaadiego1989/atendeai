import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectAudienceTypeVO } from '../value-objects/ProspectAudienceType';
import { ProspectCampaignStatusVO } from '../value-objects/ProspectCampaignStatus';
import { ProspectChannelVO } from '../value-objects/ProspectChannel';

interface ProspectCampaignProps {
  tenantId: TenantId;
  name: string;
  objective: string;
  audienceType: ProspectAudienceTypeVO;
  channel: ProspectChannelVO;
  targetContactIds: string[];
  messageTemplate?: string;
  dailyLimit: number;
  status: ProspectCampaignStatusVO;
}

export class ProspectCampaign extends AggregateRoot<ProspectCampaignProps> {
  private constructor(
    props: ProspectCampaignProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get objective(): string {
    return this.props.objective;
  }

  get audienceType(): ProspectAudienceTypeVO {
    return this.props.audienceType;
  }

  get channel(): ProspectChannelVO {
    return this.props.channel;
  }

  get targetContactIds(): string[] {
    return [...this.props.targetContactIds];
  }

  get messageTemplate(): string | undefined {
    return this.props.messageTemplate;
  }

  get dailyLimit(): number {
    return this.props.dailyLimit;
  }

  get status(): ProspectCampaignStatusVO {
    return this.props.status;
  }

  public static create(
    props: Omit<
      ProspectCampaignProps,
      'status' | 'dailyLimit' | 'targetContactIds'
    > & {
      dailyLimit?: number;
      targetContactIds?: string[];
    },
    id?: UniqueEntityID,
  ): ProspectCampaign {
    const normalizedTargetContactIds = [
      ...new Set(props.targetContactIds?.filter(Boolean) ?? []),
    ];
    const dailyLimit = props.dailyLimit ?? 50;

    if (dailyLimit <= 0 || dailyLimit > 500) {
      throw new ValidationErrorException(
        'Prospect campaign daily limit must be between 1 and 500',
      );
    }

    if (
      props.audienceType.value === 'CONTACT_LIST' &&
      normalizedTargetContactIds.length === 0
    ) {
      throw new ValidationErrorException(
        'Contact-list prospect campaigns require at least one target contact',
      );
    }

    return new ProspectCampaign(
      {
        ...props,
        targetContactIds: normalizedTargetContactIds,
        dailyLimit,
        status: ProspectCampaignStatusVO.create('DRAFT'),
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectCampaignProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectCampaign {
    return new ProspectCampaign(props, id, createdAt, updatedAt);
  }

  public activate(): void {
    if (!['DRAFT', 'PAUSED'].includes(this.props.status.value)) {
      throw new ValidationErrorException(
        'Only draft or paused prospect campaigns can be activated',
      );
    }

    this.props.status = ProspectCampaignStatusVO.create('ACTIVE');
    this.updatedAt = new Date();
  }

  public pause(): void {
    if (this.props.status.value !== 'ACTIVE') {
      throw new ValidationErrorException(
        'Only active prospect campaigns can be paused',
      );
    }

    this.props.status = ProspectCampaignStatusVO.create('PAUSED');
    this.updatedAt = new Date();
  }
}
