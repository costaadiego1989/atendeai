import { TenantId } from '@shared/domain/TenantId';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { RegisterProspectResponseUseCase } from '../application/use-cases/RegisterProspectResponseUseCase';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

function makeContactedExecution() {
  const execution = ProspectExecution.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    campaignId: new UniqueEntityID('123e4567-e89b-12d3-a456-426614174001'),
    contactId: 'contact-1',
    channel: ProspectChannelVO.create('WHATSAPP'),
  });
  execution.markAsContacted();
  return execution;
}

describe('RegisterProspectResponseUseCase', () => {
  let useCase: RegisterProspectResponseUseCase;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;

  beforeEach(() => {
    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findAllByCampaign: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
    };

    useCase = new RegisterProspectResponseUseCase(executionRepository);
  });

  it('should mark the latest contacted execution as responded', async () => {
    const execution = makeContactedExecution();
    executionRepository.findLatestContactedByContact.mockResolvedValue(
      execution,
    );

    const result = await useCase.execute({
      tenantId: execution.tenantId.toString(),
      contactId: execution.contactId,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      messageText: 'Tenho interesse',
    });

    expect(executionRepository.save).toHaveBeenCalledWith(execution);
    expect(result).toEqual(
      expect.objectContaining({
        executionId: execution.id.toString(),
        status: 'RESPONDED',
      }),
    );
  });

  it('should be a no-op when there is no contacted execution for the contact', async () => {
    executionRepository.findLatestContactedByContact.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        contactId: 'contact-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        messageText: 'Tenho interesse',
      }),
    ).resolves.toBeNull();

    expect(executionRepository.save).not.toHaveBeenCalled();
  });
});
