import { Contact } from '@modules/contact/domain/entities/Contact';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ContactName } from '@modules/contact/domain/value-objects/ContactName';
import { ContactStageVO } from '@modules/contact/domain/value-objects/ContactStage';
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
import { StartProspectCampaignUseCase } from '../application/use-cases/StartProspectCampaignUseCase';
import {
  ASSISTED_LOCAL_PROSPECTING_OBJECTIVE_PREFIX,
  ProspectDispatchPolicy,
} from '../application/services/ProspectDispatchPolicy';

function makeCampaign(props?: {
  audienceType?: 'REENGAGEMENT' | 'CONTACT_LIST';
  targetContactIds?: string[];
  dailyLimit?: number;
}) {
  const campaign = ProspectCampaign.create({
    tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
    name: 'Campanha de inicio',
    objective: 'Comecar prospecção',
    audienceType: ProspectAudienceTypeVO.create(
      props?.audienceType ?? 'CONTACT_LIST',
    ),
    channel: ProspectChannelVO.create('WHATSAPP'),
    targetContactIds: props?.targetContactIds ?? ['contact-1', 'contact-2'],
    messageTemplate: 'Oi {{first_name}}, tudo bem?',
    dailyLimit: props?.dailyLimit ?? 10,
  });
  campaign.activate();
  return campaign;
}

function makeContact(props: {
  id: string;
  stage?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
  withInteraction?: boolean;
}) {
  const contact = Contact.create(
    {
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create(`Contato ${props.id}`),
      phone: `1199999${props.id.slice(-4).padStart(4, '0')}`,
      email: `${props.id}@test.com`,
    },
    undefined,
  );

  if (props.stage && props.stage !== 'LEAD') {
    contact.updateStage(ContactStageVO.create(props.stage));
  }

  if (props.withInteraction) {
    contact.recordInteraction();
  }

  return contact;
}

describe('StartProspectCampaignUseCase', () => {
  let useCase: StartProspectCampaignUseCase;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;
  let executionRepository: jest.Mocked<IProspectExecutionRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;

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

    useCase = new StartProspectCampaignUseCase(
      campaignRepository,
      executionRepository,
      contactFacade,
      new ProspectDispatchPolicy(),
    );
  });

  it('should create pending executions for a contact-list campaign, skipping duplicates', async () => {
    const campaign = makeCampaign({
      audienceType: 'CONTACT_LIST',
      targetContactIds: ['contact-1', 'contact-2', 'contact-2', 'contact-3'],
      dailyLimit: 2,
    });
    const existingExecution = ProspectExecution.create({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      contactId: 'contact-1',
      channel: campaign.channel,
    });

    campaignRepository.findById.mockResolvedValue(campaign);
    executionRepository.findAllByCampaign.mockResolvedValue([existingExecution]);

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      campaignId: campaign.id.toString(),
    });

    expect(executionRepository.saveMany).toHaveBeenCalledTimes(1);
    const createdExecutions = executionRepository.saveMany.mock.calls[0][0];
    expect(createdExecutions).toHaveLength(1);
    expect(createdExecutions[0].contactId).toBe('contact-2');
    expect(result.createdExecutions).toBe(1);
    expect(result.skippedExecutions).toBe(1);
    expect(result.executions[0]).toEqual(
      expect.objectContaining({
        contactId: 'contact-2',
        status: 'PENDING',
      }),
    );
  });

  it('should resolve a reengagement audience from existing contacts with past interaction', async () => {
    const campaign = makeCampaign({
      audienceType: 'REENGAGEMENT',
      targetContactIds: [],
      dailyLimit: 2,
    });
    const qualifyingLead = makeContact({
      id: 'contact-10',
      withInteraction: true,
    });
    const qualifyingProspect = makeContact({
      id: 'contact-11',
      stage: 'OPPORTUNITY',
      withInteraction: true,
    });

    campaignRepository.findById.mockResolvedValue(campaign);
    executionRepository.findAllByCampaign.mockResolvedValue([]);
    contactFacade.findContactIdsForReengagementAudience.mockResolvedValue([
      qualifyingLead.id.toString(),
      qualifyingProspect.id.toString(),
    ]);

    const result = await useCase.execute({
      tenantId: campaign.tenantId.toString(),
      campaignId: campaign.id.toString(),
    });

    expect(
      contactFacade.findContactIdsForReengagementAudience,
    ).toHaveBeenCalledWith(campaign.tenantId.toString(), 2);
    expect(result.createdExecutions).toBe(2);
    expect(result.executions.map((execution) => execution.contactId)).toEqual([
      qualifyingLead.id.toString(),
      qualifyingProspect.id.toString(),
    ]);
  });

  it('should throw when the campaign does not exist', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        campaignId: 'missing-campaign',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should reject starting a campaign that is not active', async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Campanha draft',
      objective: 'Ainda não pode iniciar',
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds: ['contact-1'],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
    });
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should reject starting a campaign with an empty audience', async () => {
    const campaign = makeCampaign({
      audienceType: 'REENGAGEMENT',
      targetContactIds: [],
    });
    campaignRepository.findById.mockResolvedValue(campaign);
    executionRepository.findAllByCampaign.mockResolvedValue([]);
    contactFacade.findContactIdsForReengagementAudience.mockResolvedValue([]);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
  });

  it('should reject starting assisted local prospecting queues for automatic dispatch', async () => {
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
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
    expect(executionRepository.saveMany).not.toHaveBeenCalled();
  });

  it('should reject starting a campaign without personalization tokens in the template', async () => {
    const campaign = ProspectCampaign.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: 'Campanha sem personalização',
      objective: 'Mensagem genérica',
      audienceType: ProspectAudienceTypeVO.create('CONTACT_LIST'),
      channel: ProspectChannelVO.create('WHATSAPP'),
      targetContactIds: ['contact-1'],
      messageTemplate: 'Olá, temos uma condição especial para você.',
    });
    campaign.activate();
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      useCase.execute({
        tenantId: campaign.tenantId.toString(),
        campaignId: campaign.id.toString(),
      }),
    ).rejects.toThrow(ValidationErrorException);
    expect(executionRepository.saveMany).not.toHaveBeenCalled();
  });
});
