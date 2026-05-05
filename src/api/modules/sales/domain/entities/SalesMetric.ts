import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';

interface SalesMetricProps {
  tenantId: string;
  date: Date;
  totalMessages: number;
  purchaseIntents: number;
  paymentLinksGenerated: number;
  estimatedRevenue: number;
  updatedAt: Date;
}

export class SalesMetric extends Entity<SalesMetricProps> {
  private constructor(props: SalesMetricProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get date(): Date {
    return this.props.date;
  }
  get totalMessages(): number {
    return this.props.totalMessages;
  }
  get purchaseIntents(): number {
    return this.props.purchaseIntents;
  }
  get paymentLinksGenerated(): number {
    return this.props.paymentLinksGenerated;
  }
  get estimatedRevenue(): number {
    return this.props.estimatedRevenue;
  }

  public static create(
    props: Omit<SalesMetricProps, 'updatedAt'>,
    id?: UniqueEntityID,
  ): SalesMetric {
    return new SalesMetric(
      {
        ...props,
        updatedAt: new Date(),
      },
      id,
    );
  }

  public incrementMessages(): void {
    this.props.totalMessages++;
    this.props.updatedAt = new Date();
  }

  public incrementIntents(): void {
    this.props.purchaseIntents++;
    this.props.updatedAt = new Date();
  }

  public incrementLinks(value: number): void {
    this.props.paymentLinksGenerated++;
    this.props.estimatedRevenue += value;
    this.props.updatedAt = new Date();
  }
}
