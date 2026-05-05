import { TenantId } from '@shared/domain/TenantId';
import {
  IProspectExecutionRepository,
} from '../domain/repositories/IProspectExecutionRepository';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { RegisterProspectStopUseCase } from '../application/use-cases/RegisterProspectStopUseCase';
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

describe('RegisterProspectStopUseCase', () => {
  let useCase: RegisterProspectStopUseCase;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;

  beforeEach(() => {
    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
    };

    useCase = new RegisterProspectStopUseCase(executionRepository);
  });

  it('should mark the latest contacted execution as stopped', async () => {
    const execution = makeContactedExecution();
    executionRepository.findLatestContactedByContact.mockResolvedValue(
      execution,
    );

    const result = await useCase.execute({
      tenantId: execution.tenantId.toString(),
      contactId: execution.contactId,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      messageText: 'pare de me mandar mensagem',
    });

    expect(executionRepository.save).toHaveBeenCalledWith(execution);
    expect(result).toEqual(
      expect.objectContaining({
        executionId: execution.id.toString(),
        status: 'STOPPED',
        stopReason: 'OPT_OUT',
      }),
    );
    expect(execution.stopReason?.value).toBe('OPT_OUT');
  });

  it('should be a no-op when there is no contacted execution for the contact', async () => {
    executionRepository.findLatestContactedByContact.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        contactId: 'contact-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        messageText: 'pare',
      }),
    ).resolves.toBeNull();

    expect(executionRepository.save).not.toHaveBeenCalled();
  });
});
