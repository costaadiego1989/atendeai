import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../../shared/domain/TenantId';

interface UsageRecordProps {
  tenantId: TenantId;
  periodStart: Date;
  periodEnd: Date;
  messagesUsed: number;
  aiTokensUsed: number;
  contactsUsed: number;
  updatedAt: Date;
}

export class UsageRecord extends Entity<UsageRecordProps> {
  private constructor(props: UsageRecordProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get periodStart(): Date {
    return this.props.periodStart;
  }
  get periodEnd(): Date {
    return this.props.periodEnd;
  }
  get messagesUsed(): number {
    return this.props.messagesUsed;
  }
  get aiTokensUsed(): number {
    return this.props.aiTokensUsed;
  }
  get contactsUsed(): number {
    return this.props.contactsUsed;
  }

  public static reconstitute(
    props: UsageRecordProps,
    id: UniqueEntityID,
  ): UsageRecord {
    return new UsageRecord(props, id);
  }

  public static create(
    tenantId: TenantId,
    start: Date,
    end: Date,
  ): UsageRecord {
    return new UsageRecord({
      tenantId,
      periodStart: start,
      periodEnd: end,
      messagesUsed: 0,
      aiTokensUsed: 0,
      contactsUsed: 0,
      updatedAt: new Date(),
    });
  }

  public recordMessage(): void {
    this.props.messagesUsed++;
    this.props.updatedAt = new Date();
  }

  public recordTokens(count: number): void {
    this.props.aiTokensUsed += count;
    this.props.updatedAt = new Date();
  }

  public recordContact(): void {
    this.props.contactsUsed++;
    this.props.updatedAt = new Date();
  }
}
