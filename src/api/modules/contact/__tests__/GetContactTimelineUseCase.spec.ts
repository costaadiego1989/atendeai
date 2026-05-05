import { GetContactTimelineUseCase } from '../application/use-cases/GetContactTimelineUseCase';
import { IContactTimelineRepository } from '../application/ports/IContactTimelineRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('GetContactTimelineUseCase', () => {
  let useCase: GetContactTimelineUseCase;
  let contactTimelineRepository: jest.Mocked<IContactTimelineRepository>;

  beforeEach(() => {
    contactTimelineRepository = {
      getTimeline: jest.fn(),
    };

    useCase = new GetContactTimelineUseCase(contactTimelineRepository);
  });

  it('should return the timeline when the contact exists', async () => {
    const timeline = {
      contact: {
        id: 'contact-1',
        name: 'Lead Example',
        phone: '5511999999999',
        stage: 'LEAD',
      },
      entries: [
        {
          timestamp: new Date('2026-01-01T10:00:00.000Z'),
          type: 'CONTACT_CREATED' as const,
          title: 'Contato criado',
          details: { name: 'Lead Example' },
        },
      ],
    };
    contactTimelineRepository.getTimeline.mockResolvedValue(timeline);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
    });

    expect(contactTimelineRepository.getTimeline).toHaveBeenCalledWith(
      'tenant-1',
      'contact-1',
    );
    expect(result).toBe(timeline);
  });

  it('should throw EntityNotFoundException when the contact timeline does not exist', async () => {
    contactTimelineRepository.getTimeline.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        contactId: 'missing-contact',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
