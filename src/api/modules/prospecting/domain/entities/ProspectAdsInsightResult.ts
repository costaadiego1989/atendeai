import { Entity } from '@shared/domain/Entity';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectAdsInsightResultType =
  | 'DEMAND_ESTIMATE'
  | 'INTEREST'
  | 'REGION'
  | 'KEYWORD_THEME';

interface ProspectAdsInsightResultProps {
  tenantId: TenantId;
  queryId: UniqueEntityID;
  resultType: ProspectAdsInsightResultType;
  title: string;
  subtitle?: string;
  metricValue?: number;
  score?: number;
  metadata?: Record<string, unknown>;
}

export class ProspectAdsInsightResult extends Entity<ProspectAdsInsightResultProps> {
  private constructor(
    props: ProspectAdsInsightResultProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get queryId(): UniqueEntityID {
    return this.props.queryId;
  }

  get resultType(): ProspectAdsInsightResultType {
    return this.props.resultType;
  }

  get title(): string {
    return this.props.title;
  }

  get subtitle(): string | undefined {
    return this.props.subtitle;
  }

  get metricValue(): number | undefined {
    return this.props.metricValue;
  }

  get score(): number | undefined {
    return this.props.score;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  public static create(
    props: ProspectAdsInsightResultProps,
    id?: UniqueEntityID,
  ): ProspectAdsInsightResult {
    const title = props.title?.trim();
    if (!title) {
      throw new ValidationErrorException(
        'Prospect Ads insight result title is required',
      );
    }

    return new ProspectAdsInsightResult(
      {
        ...props,
        title,
        subtitle: props.subtitle?.trim() || undefined,
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectAdsInsightResultProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): ProspectAdsInsightResult {
    return new ProspectAdsInsightResult(props, id, createdAt, updatedAt);
  }
}
