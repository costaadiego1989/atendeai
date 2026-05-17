import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../../shared/domain/TenantId';
import { ContactName } from '../value-objects/ContactName';
import { ContactStageVO } from '../value-objects/ContactStage';
import {
  ContactCreatedDomainEvent,
  ContactInteractionRecordedDomainEvent,
  ContactStageChangedDomainEvent,
  ContactUpdatedDomainEvent,
} from '../events/ContactEvents';

interface ContactProps {
  tenantId: TenantId;
  branchId?: string;
  name: ContactName;
  phone: string;
  document?: string;
  email?: string;
  stage: ContactStageVO;
  tags: string[];
  notes?: string;
  lastInteraction?: Date;
  prospectingOptOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Contact extends AggregateRoot<ContactProps> {
  private constructor(props: ContactProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get name(): ContactName {
    return this.props.name;
  }
  get branchId(): string | undefined {
    return this.props.branchId;
  }
  get phone(): string {
    return this.props.phone;
  }
  get email(): string | undefined {
    return this.props.email;
  }
  get document(): string | undefined {
    return this.props.document;
  }
  get stage(): ContactStageVO {
    return this.props.stage;
  }
  get tags(): string[] {
    return this.props.tags;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get lastInteraction(): Date | undefined {
    return this.props.lastInteraction;
  }

  get prospectingOptOut(): boolean {
    return this.props.prospectingOptOut;
  }

  public static reconstitute(props: ContactProps, id: UniqueEntityID): Contact {
    return new Contact(props, id);
  }

  public static create(
    props: Omit<
      ContactProps,
      'stage' | 'tags' | 'createdAt' | 'updatedAt' | 'prospectingOptOut'
    > & {
      stage?: ContactStageVO;
      tags?: string[];
    },
    id?: UniqueEntityID,
  ): Contact {
    const contact = new Contact(
      {
        ...props,
        stage: props.stage ?? ContactStageVO.create('LEAD'),
        tags: props.tags || [],
        prospectingOptOut: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );

    if (!id) {
      contact.addDomainEvent(
        new ContactCreatedDomainEvent(
          contact.id,
          contact.tenantId.toString(),
          contact.name.value,
          contact.phone,
          contact.email,
          contact.stage.value,
        ),
      );
    }

    return contact;
  }

  public updateStage(newStage: ContactStageVO): void {
    const previousStage = this.props.stage.value;
    this.props.stage = newStage;
    this.props.updatedAt = new Date();

    if (previousStage !== newStage.value) {
      this.addDomainEvent(
        new ContactStageChangedDomainEvent(
          this.id,
          this.tenantId.toString(),
          previousStage,
          newStage.value,
        ),
      );
    }
  }

  public addTag(tag: string): void {
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
      this.props.updatedAt = new Date();
    }
  }

  public removeTag(tag: string): void {
    const index = this.props.tags.indexOf(tag);
    if (index > -1) {
      this.props.tags.splice(index, 1);
      this.props.updatedAt = new Date();
    }
  }

  public markProspectingOptOut(): void {
    this.props.prospectingOptOut = true;
    this.props.updatedAt = new Date();
  }

  public recordInteraction(): void {
    this.props.lastInteraction = new Date();
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new ContactInteractionRecordedDomainEvent(
        this.id,
        this.tenantId.toString(),
        this.props.lastInteraction,
      ),
    );
  }

  public updateDetails(props: {
    name?: ContactName;
    document?: string;
    email?: string;
    notes?: string;
    tags?: string[];
  }): void {
    const previousSnapshot = JSON.stringify({
      name: this.props.name.value,
      document: this.props.document,
      email: this.props.email,
      notes: this.props.notes,
      tags: this.props.tags,
    });

    if (props.name) this.props.name = props.name;
    if (props.document !== undefined) this.props.document = props.document;
    if (props.email !== undefined) this.props.email = props.email;
    if (props.notes !== undefined) this.props.notes = props.notes;
    if (props.tags) this.props.tags = props.tags;
    this.props.updatedAt = new Date();

    const currentSnapshot = JSON.stringify({
      name: this.props.name.value,
      document: this.props.document,
      email: this.props.email,
      notes: this.props.notes,
      tags: this.props.tags,
    });

    if (previousSnapshot !== currentSnapshot) {
      this.addDomainEvent(
        new ContactUpdatedDomainEvent(
          this.id,
          this.tenantId.toString(),
          this.name.value,
          this.phone,
          this.email,
          [...this.tags],
          this.stage.value,
          this.notes,
        ),
      );
    }
  }

  public assignBranch(branchId?: string): void {
    if (this.props.branchId === branchId) {
      return;
    }

    this.props.branchId = branchId;
    this.props.updatedAt = new Date();
  }
}
