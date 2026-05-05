import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectSearchSourceVO } from '../value-objects/ProspectSearchSource';
import { ProspectSearchStatusVO } from '../value-objects/ProspectSearchStatus';

interface ProspectAdsInsightQueryProps {
  tenantId: TenantId;
  source: ProspectSearchSourceVO;
  segment: string;
  city?: string;
  state?: string;
  country: string;
  ageRange?: string;
  gender?: string;
  interest?: string;
  status: ProspectSearchStatusVO;
  discoveredCount: number;
  failureReason?: string;
}

export class ProspectAdsInsightQuery extends AggregateRoot<ProspectAdsInsightQueryProps> {
  private constructor(
    props: ProspectAdsInsightQueryProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get source(): ProspectSearchSourceVO {
    return this.props.source;
  }

  get segment(): string {
    return this.props.segment;
  }

  get city(): string | undefined {
    return this.props.city;
  }

  get state(): string | undefined {
    return this.props.state;
  }

  get country(): string {
    return this.props.country;
  }

  get ageRange(): string | undefined {
    return this.props.ageRange;
  }

  get gender(): string | undefined {
    return this.props.gender;
  }

  get interest(): string | undefined {
    return this.props.interest;
  }

  get status(): ProspectSearchStatusVO {
    return this.props.status;
  }

  get discoveredCount(): number {
    return this.props.discoveredCount;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  public static create(
    props: Omit<
      ProspectAdsInsightQueryProps,
      'status' | 'discoveredCount' | 'source'
    > & { source?: ProspectSearchSourceVO },
    id?: UniqueEntityID,
  ): ProspectAdsInsightQuery {
    const segment = props.segment?.trim();
    if (!segment || segment.length < 2) {
      throw new ValidationErrorException(
        'Prospect Ads insight segment must have at least 2 characters',
      );
    }

    return new ProspectAdsInsightQuery(
      {
        tenantId: props.tenantId,
        source: props.source ?? ProspectSearchSourceVO.create('GOOGLE_ADS_AUDIENCE'),
        segment,
        city: props.city?.trim() || undefined,
        state: props.state?.trim() || undefined,
        country: props.country?.trim() || 'BR',
        ageRange: props.ageRange?.trim() || undefined,
        gender: props.gender?.trim() || undefined,
        interest: props.interest?.trim() || undefined,
        status: ProspectSearchStatusVO.create('PENDING'),
        discoveredCount: 0,
        failureReason: undefined,
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectAdsInsightQueryProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectAdsInsightQuery {
    return new ProspectAdsInsightQuery(props, id, createdAt, updatedAt);
  }

  public markAsRunning(): void {
    this.props.status = ProspectSearchStatusVO.create('RUNNING');
    this.props.failureReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsCompleted(discoveredCount: number): void {
    this.props.status = ProspectSearchStatusVO.create('COMPLETED');
    this.props.discoveredCount = discoveredCount;
    this.props.failureReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsFailed(reason: string): void {
    this.props.status = ProspectSearchStatusVO.create('FAILED');
    this.props.failureReason = reason?.trim() || 'Unknown Google Ads insight failure';
    this.updatedAt = new Date();
  }
}
