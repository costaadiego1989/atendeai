import { TenantId } from '@shared/domain/TenantId';
import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectChannelVO } from '../value-objects/ProspectChannel';
import { ProspectExecutionStatusVO } from '../value-objects/ProspectExecutionStatus';
import { ProspectStopReasonVO } from '../value-objects/ProspectStopReason';

interface ProspectExecutionProps {
  tenantId: TenantId;
  campaignId: UniqueEntityID;
  contactId: string;
  channel: ProspectChannelVO;
  status: ProspectExecutionStatusVO;
  attemptCount: number;
  stopReason?: ProspectStopReasonVO;
}

export class ProspectExecution extends AggregateRoot<ProspectExecutionProps> {
  private constructor(
    props: ProspectExecutionProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get campaignId(): UniqueEntityID {
    return this.props.campaignId;
  }

  get contactId(): string {
    return this.props.contactId;
  }

  get channel(): ProspectChannelVO {
    return this.props.channel;
  }

  get status(): ProspectExecutionStatusVO {
    return this.props.status;
  }

  get attemptCount(): number {
    return this.props.attemptCount;
  }

  get stopReason(): ProspectStopReasonVO | undefined {
    return this.props.stopReason;
  }

  public static reconstitute(
    props: ProspectExecutionProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectExecution {
    return new ProspectExecution(props, id, createdAt, updatedAt);
  }

  public static create(
    props: Omit<ProspectExecutionProps, 'status' | 'attemptCount'>,
    id?: UniqueEntityID,
  ): ProspectExecution {
    if (!props.contactId?.trim()) {
      throw new ValidationErrorException(
        'Prospect execution requires a target contact',
      );
    }

    return new ProspectExecution(
      {
        ...props,
        contactId: props.contactId.trim(),
        status: ProspectExecutionStatusVO.create('PENDING'),
        attemptCount: 0,
        stopReason: undefined,
      },
      id,
    );
  }

  public markAsContacted(): void {
    if (this.props.status.value !== 'PENDING') {
      throw new ValidationErrorException(
        'Only pending prospect executions can be marked as contacted',
      );
    }

    this.props.status = ProspectExecutionStatusVO.create('CONTACTED');
    this.props.attemptCount += 1;
    this.props.stopReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsResponded(): void {
    if (this.props.status.value !== 'CONTACTED') {
      throw new ValidationErrorException(
        'Only contacted prospect executions can be marked as responded',
      );
    }

    this.props.status = ProspectExecutionStatusVO.create('RESPONDED');
    this.props.stopReason = undefined;
    this.updatedAt = new Date();
  }

  public markAsStopped(reason: ProspectStopReasonVO): void {
    if (this.props.status.value !== 'CONTACTED') {
      throw new ValidationErrorException(
        'Only contacted prospect executions can be marked as stopped',
      );
    }

    this.props.status = ProspectExecutionStatusVO.create('STOPPED');
    this.props.stopReason = reason;
    this.updatedAt = new Date();
  }

  public markAsOptedOut(): void {
    if (!['PENDING', 'CONTACTED'].includes(this.props.status.value)) {
      return;
    }

    this.props.status = ProspectExecutionStatusVO.create('STOPPED');
    this.props.stopReason = ProspectStopReasonVO.create('OPT_OUT');
    this.updatedAt = new Date();
  }

  public markAsFailedDispatch(reason: ProspectStopReasonVO): void {
    if (this.props.status.value !== 'PENDING') {
      throw new ValidationErrorException(
        'Only pending executions can be marked as dispatch-failed',
      );
    }

    this.props.status = ProspectExecutionStatusVO.create('STOPPED');
    this.props.stopReason = reason;
    this.updatedAt = new Date();
  }
}
