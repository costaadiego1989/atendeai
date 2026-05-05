import { TenantId } from '@shared/domain/TenantId';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ProspectCampaign } from '../domain/entities/ProspectCampaign';
import { ProspectExecution } from '../domain/entities/ProspectExecution';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { IProspectExecutionRepository } from '../domain/repositories/IProspectExecutionRepository';
import { ProspectAudienceTypeVO } from '../domain/value-objects/ProspectAudienceType';
import { ProspectChannelVO } from '../domain/value-objects/ProspectChannel';
import { DispatchProspectExecutionUseCase } from '../application/use-cases/DispatchProspectExecutionUseCase';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { IMessagingFacade } from '@modules/messaging/application/facades/MessagingFacade';
import {
  ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX,
  ProspectDispatchPolicy,
} from '../application/services/ProspectDispatchPolicy';

function makeCampaign(messageTemplate = 'Oi {{first_name}}, tudo bem?') {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha outbound',
    objective: 'Enviar primeiro toque',
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: ['contact-1'],
    messageTemplate,
  });
  campaign.activate();
  return campaign;
}

function makeAssistedLocalQueue() {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Abordagem Clinica odontologica - Campinas',
    objective: `${ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX}: preparar abordagem comercial`,
    audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: ['contact-1'],
    messageTemplate: 'Oi {{first_name}}, tudo bem?',
  });
  campaign.activate();
  return campaign;
}

function makeExecution(campaign: ProspectCampaign) {
  return ProspectExecution.create({
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    contactId: 'contact-1',
    channel: campaign.channel,
  });
}

describe('DispatchProspectExecutionUseCase', () => {
  let useCase: DispatchProspectExecutionUseCase;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let messagingFacade: jest.Mocked<IMessagingFacade>;

  beforeEach(() => {
    campaignRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    executionRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findLatestContactedByContact: jest.fn(),
      findAllByCampaign: jest.fn(),
      findNextPendingByCampaign: jest.fn(),
    };
    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn(),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
    };
    messagingFacade = {
      queueSystemMessage: jest.fn(),
    };

    useCase = new DispatchProspectExecutionUseCase(
      campaignRepository,
      executionRepository,
      contactFacade,
      messagingFacade,
      new ProspectDispatchPolicy(),
    );
  });

  it('should queue the outbound system message and mark execution as contacted', async () => {
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);

    executionRepository.findById.mockResolvedValue(execution);
    campaignRepository.findById.mockResolvedValue(campaign);
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Maria Silva',
      phone: '11999998888',
      email: 'maria@test.com',
    });
    messagingFacade.queueSystemMessage.mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
    });

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      executionId: execution.id.toString(),
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith({
      tenantId: campaign.tenantId.toString(),
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: 'Oi Maria, tudo bem?',
    });
    expect(executionRepository.save).toHaveBeenCalledWith(execution);
    expect(result.status).toBe('CONTACTED');
    expect(result.renderedMessage).toBe('Oi Maria, tudo bem?');
  });

  it('should use the messaging facade result when dispatching the message', async () => {
    const campaign = makeCampaign('Oi {{name}}, temos novidades');
    const execution = makeExecution(campaign);

    executionRepository.findById.mockResolvedValue(execution);
    campaignRepository.findById.mockResolvedValue(campaign);
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Maria Silva',
      phone: '11999998888',
      email: 'maria@test.com',
    });
    messagingFacade.queueSystemMessage.mockResolvedValue({
      conversationId: 'conversation-99',
      messageId: 'message-99',
    });

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      executionId: execution.id.toString(),
    });

    expect(result.conversationId).toBe('conversation-99');
    expect(result.renderedMessage).toBe('Oi Maria Silva, temos novidades');
  });

  it('should throw when the execution is not found', async () => {
    executionRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        executionId: 'missing-execution',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should reject dispatching an execution that is not pending', async () => {
    const campaign = makeCampaign();
    const execution = makeExecution(campaign);
    execution.markAsContacted();

    executionRepository.findById.mockResolvedValue(execution);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        executionId: execution.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should reject campaigns without a message template', async () => {
    const campaign = makeCampaign('');
    const execution = makeExecution(campaign);

    executionRepository.findById.mockResolvedValue(execution);
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        executionId: execution.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should reject dispatch when the template has no personalization token', async () => {
    const campaign = makeCampaign('Olá, temos uma condição especial para você.');
    const execution = makeExecution(campaign);

    executionRepository.findById.mockResolvedValue(execution);
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        executionId: execution.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('should reject automatic dispatch from assisted local prospecting queues', async () => {
    const campaign = makeAssistedLocalQueue();
    const execution = makeExecution(campaign);

    executionRepository.findById.mockResolvedValue(execution);
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        executionId: execution.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });
});
