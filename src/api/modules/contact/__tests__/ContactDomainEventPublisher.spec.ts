import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { ContactStageVO } from '../domain/value-objects/ContactStage';

describe('ContactDomainEventPublisher', () => {
  let publisher: ContactDomainEventPublisher;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;

    publisher = new ContactDomainEventPublisher(eventBus);
  });

  it('should publish contact.created and clear domain events', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Contact One'),
      phone: '5511999999999',
      email: 'contact@test.com',
    });

    await publisher.publishFromAggregate(contact);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0].queue).toBe('contact.created');
    expect(eventBus.publish.mock.calls[0][0].payload).toEqual({
      contactId: contact.id.toString(),
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Contact One',
      phone: '5511999999999',
      email: 'contact@test.com',
      stage: 'LEAD',
    });
    expect(contact.domainEvents).toHaveLength(0);
  });

  it('should publish stage-changed and interaction-recorded events', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Contact Two'),
      phone: '5511888888888',
    });
    contact.clearEvents();
    contact.updateStage(ContactStageVO.create('PROSPECT'));
    contact.recordInteraction();

    await publisher.publishFromAggregate(contact);

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish.mock.calls[0][0].queue).toBe(
      'contact.stage-changed',
    );
    expect(eventBus.publish.mock.calls[1][0].queue).toBe(
      'contact.interaction-recorded',
    );
    expect(contact.domainEvents).toHaveLength(0);
  });
});
