import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TenantId } from '@shared/domain/TenantId';

export type TaskStatus = 'PENDING' | 'DONE' | 'CANCELLED';
export type TaskSource = 'MANUAL' | 'AUTOMATION';

export interface TaskProps {
  tenantId: TenantId;
  contactId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dueAt?: Date | null;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
}

export class Task extends AggregateRoot<TaskProps> {
  private constructor(props: TaskProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get contactId(): string | null {
    return this.props.contactId ?? null;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string | null {
    return this.props.description ?? null;
  }
  get status(): TaskStatus {
    return this.props.status;
  }
  get dueAt(): Date | null {
    return this.props.dueAt ?? null;
  }
  get source(): TaskSource {
    return this.props.source;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static reconstitute(props: TaskProps, id: UniqueEntityID): Task {
    return new Task(props, id);
  }

  public static create(
    props: {
      tenantId: TenantId;
      contactId?: string | null;
      title: string;
      description?: string | null;
      dueAt?: Date | null;
      source?: TaskSource;
    },
    id?: UniqueEntityID,
  ): Task {
    const title = props.title?.trim();
    if (!title) {
      throw new Error('Task title is required');
    }

    return new Task(
      {
        tenantId: props.tenantId,
        contactId: props.contactId ?? null,
        title,
        description: props.description ?? null,
        status: 'PENDING',
        dueAt: props.dueAt ?? null,
        source: props.source ?? 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
  }
}
