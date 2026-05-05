import { UserDomainEventPublisher } from '../application/services/UserDomainEventPublisher';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';

describe('UserDomainEventPublisher', () => {
  let publisher: UserDomainEventPublisher;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    publisher = new UserDomainEventPublisher(eventBus);
  });

  it('should publish tenant.user-created and clear domain events', async () => {
    const user = User.create({
      name: 'John Admin',
      email: Email.create('john@tenant.com'),
      phone: Phone.create('11999998888'),
      passwordHash: 'hashed-password',
      role: Role.create('ADMIN'),
    });

    await publisher.publishFromAggregate(user, 'tenant-1');

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0].queue).toBe('tenant.user-created');
    expect(eventBus.publish.mock.calls[0][0].payload).toEqual({
      userId: user.id.toValue(),
      tenantId: 'tenant-1',
      name: 'John Admin',
      email: 'john@tenant.com',
      phone: '+5511999998888',
      role: 'ADMIN',
    });
    expect(user.domainEvents).toHaveLength(0);
  });
});
