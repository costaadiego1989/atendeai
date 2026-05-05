import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectSearchSourceVO } from '../value-objects/ProspectSearchSource';
import { ProspectSearchStatusVO } from '../value-objects/ProspectSearchStatus';

interface ProspectSearchProps {
  tenantId: TenantId;
  businessTypeQuery: string;
  city: string;
  state?: string;
  neighborhood?: string;
  source: ProspectSearchSourceVO;
  maxResults: number;
  status: ProspectSearchStatusVO;
  discoveredCount: number;
  failureReason?: string;
}

export class ProspectSearch extends AggregateRoot<ProspectSearchProps> {
  private constructor(
    props: ProspectSearchProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get businessTypeQuery(): string {
    return this.props.businessTypeQuery;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string | undefined {
    return this.props.state;
  }

  get neighborhood(): string | undefined {
    return this.props.neighborhood;
  }

  get source(): ProspectSearchSourceVO {
    return this.props.source;
  }

  get maxResults(): number {
    return this.props.maxResults;
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
    props: Omit<ProspectSearchProps, 'status' | 'discoveredCount' | 'maxResults'> & {
      maxResults?: number;
    },
    id?: UniqueEntityID,
  ): ProspectSearch {
    const businessTypeQuery = props.businessTypeQuery?.trim();
    const city = props.city?.trim();
    const state = props.state?.trim() || undefined;
    const neighborhood = props.neighborhood?.trim() || undefined;
    const maxResults = props.maxResults ?? 50;

    if (!businessTypeQuery || businessTypeQuery.length < 2) {
      throw new ValidationErrorException(
        'Prospect search business type query must have at least 2 characters',
      );
    }

    if (!city || city.length < 2) {
      throw new ValidationErrorException(
        'Prospect search city must have at least 2 characters',
      );
    }

    if (maxResults <= 0 || maxResults > 200) {
      throw new ValidationErrorException(
        'Prospect search max results must be between 1 and 200',
      );
    }

    return new ProspectSearch(
      {
        businessTypeQuery,
        city,
        tenantId: props.tenantId,
        state,
        neighborhood,
        source: props.source,
        maxResults,
        status: ProspectSearchStatusVO.create('PENDING'),
        discoveredCount: 0,
        failureReason: undefined,
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectSearchProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectSearch {
    return new ProspectSearch(props, id, createdAt, updatedAt);
  }

  public markAsRunning(): void {
    if (this.props.status.value !== 'PENDING') {
      throw new ValidationErrorException(
        'Only pending prospect searches can be marked as running',
      );
    }

    this.props.status = ProspectSearchStatusVO.create('RUNNING');
    this.props.failureReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsCompleted(discoveredCount: number): void {
    if (!['PENDING', 'RUNNING'].includes(this.props.status.value)) {
      throw new ValidationErrorException(
        'Only pending or running prospect searches can be completed',
      );
    }

    if (discoveredCount < 0) {
      throw new ValidationErrorException(
        'Prospect search discovered count cannot be negative',
      );
    }

    this.props.status = ProspectSearchStatusVO.create('COMPLETED');
    this.props.discoveredCount = discoveredCount;
    this.props.failureReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsFailed(reason: string): void {
    if (!['PENDING', 'RUNNING'].includes(this.props.status.value)) {
      throw new ValidationErrorException(
        'Only pending or running prospect searches can be failed',
      );
    }

    this.props.status = ProspectSearchStatusVO.create('FAILED');
    this.props.failureReason = reason.trim() || 'Unknown search failure';
    this.updatedAt = new Date();
  }
}
