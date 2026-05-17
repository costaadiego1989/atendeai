import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectAudienceTypeVO } from '../value-objects/ProspectAudienceType';
import { ProspectCampaignStatusVO } from '../value-objects/ProspectCampaignStatus';
import { ProspectChannelVO } from '../value-objects/ProspectChannel';

interface ProspectCampaignProps {
  tenantId: TenantId;
  name: string;
  objective: string;
  audienceType: ProspectAudienceTypeVO;
  channel: ProspectChannelVO;
  targetContactIds: string[];
  messageTemplate?: string;
  templateName?: string;
  languageCode: string;
  templateVariableMapping?: Record<string, string>;
  aiVariableGeneration: boolean;
  cooldownDays: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  blockRateThreshold: number;
  dailyLimit: number;
  status: ProspectCampaignStatusVO;
  pauseReason?: string;
}

export class ProspectCampaign extends AggregateRoot<ProspectCampaignProps> {
  private constructor(
    props: ProspectCampaignProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get objective(): string {
    return this.props.objective;
  }

  get audienceType(): ProspectAudienceTypeVO {
    return this.props.audienceType;
  }

  get channel(): ProspectChannelVO {
    return this.props.channel;
  }

  get targetContactIds(): string[] {
    return [...this.props.targetContactIds];
  }

  get messageTemplate(): string | undefined {
    return this.props.messageTemplate;
  }

  get templateName(): string | undefined {
    return this.props.templateName;
  }

  get languageCode(): string {
    return this.props.languageCode;
  }

  get templateVariableMapping(): Record<string, string> | undefined {
    return this.props.templateVariableMapping;
  }

  get aiVariableGeneration(): boolean {
    return this.props.aiVariableGeneration;
  }

  get cooldownDays(): number {
    return this.props.cooldownDays;
  }

  get minDelaySeconds(): number {
    return this.props.minDelaySeconds;
  }

  get maxDelaySeconds(): number {
    return this.props.maxDelaySeconds;
  }

  get blockRateThreshold(): number {
    return this.props.blockRateThreshold;
  }

  get dailyLimit(): number {
    return this.props.dailyLimit;
  }

  get status(): ProspectCampaignStatusVO {
    return this.props.status;
  }

  get pauseReason(): string | undefined {
    return this.props.pauseReason;
  }

  public static create(
    props: Omit<
      ProspectCampaignProps,
      | 'status'
      | 'dailyLimit'
      | 'targetContactIds'
      | 'languageCode'
      | 'aiVariableGeneration'
      | 'cooldownDays'
      | 'minDelaySeconds'
      | 'maxDelaySeconds'
      | 'blockRateThreshold'
      | 'pauseReason'
    > & {
      dailyLimit?: number;
      targetContactIds?: string[];
      languageCode?: string;
      aiVariableGeneration?: boolean;
      cooldownDays?: number;
      minDelaySeconds?: number;
      maxDelaySeconds?: number;
      blockRateThreshold?: number;
    },
    id?: UniqueEntityID,
  ): ProspectCampaign {
    const normalizedTargetContactIds = [
      ...new Set(props.targetContactIds?.filter(Boolean) ?? []),
    ];
    const dailyLimit = props.dailyLimit ?? 50;

    if (dailyLimit <= 0 || dailyLimit > 500) {
      throw new ValidationErrorException(
        'Prospect campaign daily limit must be between 1 and 500',
      );
    }

    if (
      props.audienceType.value === 'CONTACT_LIST' &&
      normalizedTargetContactIds.length === 0
    ) {
      throw new ValidationErrorException(
        'Contact-list prospect campaigns require at least one target contact',
      );
    }

    return new ProspectCampaign(
      {
        ...props,
        targetContactIds: normalizedTargetContactIds,
        dailyLimit,
        languageCode: props.languageCode ?? 'pt_BR',
        aiVariableGeneration: props.aiVariableGeneration ?? false,
        cooldownDays: props.cooldownDays ?? 30,
        minDelaySeconds: props.minDelaySeconds ?? 30,
        maxDelaySeconds: props.maxDelaySeconds ?? 120,
        blockRateThreshold: props.blockRateThreshold ?? 0.05,
        status: ProspectCampaignStatusVO.create('DRAFT'),
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectCampaignProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectCampaign {
    return new ProspectCampaign(props, id, createdAt, updatedAt);
  }

  public activate(): void {
    if (!['DRAFT', 'PAUSED'].includes(this.props.status.value)) {
      throw new ValidationErrorException(
        'Only draft or paused prospect campaigns can be activated',
      );
    }

    if (this.props.channel.value === 'WHATSAPP' && !this.props.templateName) {
      throw new ValidationErrorException(
        'Template obrigatório para campanhas WhatsApp. Defina templateName antes de ativar.',
      );
    }

    this.props.status = ProspectCampaignStatusVO.create('ACTIVE');
    this.props.pauseReason = undefined;
    this.updatedAt = new Date();
  }

  public pause(): void {
    if (this.props.status.value !== 'ACTIVE') {
      throw new ValidationErrorException(
        'Only active prospect campaigns can be paused',
      );
    }

    this.props.status = ProspectCampaignStatusVO.create('PAUSED');
    this.updatedAt = new Date();
  }

  public pauseWithReason(reason: string): void {
    if (this.props.status.value !== 'ACTIVE') {
      return;
    }

    this.props.status = ProspectCampaignStatusVO.create('PAUSED');
    this.props.pauseReason = reason;
    this.updatedAt = new Date();
  }
}
