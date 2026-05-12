import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { ContactStageVO } from '../domain/value-objects/ContactStage';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import {
  ContactCreatedDomainEvent,
  ContactUpdatedDomainEvent,
  ContactStageChangedDomainEvent,
  ContactInteractionRecordedDomainEvent,
} from '../domain/events/ContactEvents';

describe('Contact (Domain Entity)', () => {
  const tenantId = TenantId.create('123e4567-e89b-12d3-a456-426614174000');

  const makeValidProps = () => ({
    tenantId,
    name: ContactName.create('John Doe'),
    phone: '5511999999999',
    email: 'john@example.com',
    document: '12345678900',
    tags: ['VIP'],
    notes: 'Some notes',
  });

  it('should create a contact with valid data', () => {
    const contact = Contact.create(makeValidProps());

    expect(contact.name.value).toBe('John Doe');
    expect(contact.phone).toBe('5511999999999');
    expect(contact.email).toBe('john@example.com');
    expect(contact.document).toBe('12345678900');
    expect(contact.tags).toContain('VIP');
    expect(contact.stage.value).toBe('LEAD');
  });

  it('should create with minimal data (only name + phone)', () => {
    const contact = Contact.create({
      tenantId,
      name: ContactName.create('Jane'),
      phone: '5511888888888',
    });

    expect(contact.name.value).toBe('Jane');
    expect(contact.phone).toBe('5511888888888');
    expect(contact.stage.value).toBe('LEAD');
    expect(contact.tags).toEqual([]);
    expect(contact.email).toBeUndefined();
    expect(contact.document).toBeUndefined();
  });

  it('should generate ContactCreated domain event on create', () => {
    const contact = Contact.create(makeValidProps());

    const events = contact.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ContactCreatedDomainEvent);

    const event = events[0] as ContactCreatedDomainEvent;
    expect(event.tenantId).toBe(tenantId.toString());
    expect(event.name).toBe('John Doe');
    expect(event.phone).toBe('5511999999999');
    expect(event.stage).toBe('LEAD');
  });

  it('should emit ContactUpdated event when updating details', () => {
    const contact = Contact.create(makeValidProps());
    contact.clearEvents();

    contact.updateDetails({
      name: ContactName.create('John Updated'),
      email: 'updated@example.com',
    });

    const events = contact.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ContactUpdatedDomainEvent);

    const event = events[0] as ContactUpdatedDomainEvent;
    expect(event.name).toBe('John Updated');
  });

  it('should emit ContactStageChanged event when changing stage', () => {
    const contact = Contact.create(makeValidProps());
    contact.clearEvents();

    contact.updateStage(ContactStageVO.create('PROSPECT'));

    const events = contact.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ContactStageChangedDomainEvent);

    const event = events[0] as ContactStageChangedDomainEvent;
    expect(event.previousStage).toBe('LEAD');
    expect(event.newStage).toBe('PROSPECT');
  });

  it('should emit ContactInteractionRecorded event on recordInteraction', () => {
    const contact = Contact.create(makeValidProps());
    contact.clearEvents();

    contact.recordInteraction();

    const events = contact.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ContactInteractionRecordedDomainEvent);

    const event = events[0] as ContactInteractionRecordedDomainEvent;
    expect(event.lastInteraction).toBeInstanceOf(Date);
  });

  it('should reconstitute without generating events', () => {
    const id = new UniqueEntityID('existing-id');
    const contact = Contact.reconstitute(
      {
        tenantId,
        name: ContactName.create('Reconstituted'),
        phone: '5511777777777',
        stage: ContactStageVO.create('CUSTOMER'),
        tags: ['returning'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      },
      id,
    );

    expect(contact.id.toValue()).toBe('existing-id');
    expect(contact.name.value).toBe('Reconstituted');
    expect(contact.stage.value).toBe('CUSTOMER');
    expect(contact.domainEvents).toHaveLength(0);
  });

  it('should determine equality by id', () => {
    const id = new UniqueEntityID('same-id');
    const contact1 = Contact.reconstitute(
      {
        tenantId,
        name: ContactName.create('Contact One'),
        phone: '5511111111111',
        stage: ContactStageVO.create('LEAD'),
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
    const contact2 = Contact.reconstitute(
      {
        tenantId,
        name: ContactName.create('Contact Two'),
        phone: '5511222222222',
        stage: ContactStageVO.create('PROSPECT'),
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );

    expect(contact1.equals(contact2)).toBe(true);
  });
});
