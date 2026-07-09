import { AggregateRoot } from '../../../../shared/domain/AggregateRoot.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { TenantId } from '../../../../shared/domain/TenantId.js';
import { randomUUID } from 'crypto';
import { CompanyName } from '../value-objects/CompanyName.js';
import { CNPJ } from '../value-objects/CNPJ.js';
import { Plan } from '../value-objects/Plan.js';
import { User } from './User.js';
import { WhatsAppConfig } from './WhatsAppConfig.js';
import { InstagramConfig } from './InstagramConfig.js';
import { AIConfig } from './AIConfig.js';
import { Address } from '../value-objects/Address.js';
import { Promotion } from '../value-objects/Promotion.js';
import {
  TenantCreated,
  TenantPlanChanged,
  WhatsAppConfigured,
  InstagramConfigured,
  InstagramDisconnected,
  AIConfigUpdated,
} from '../events/TenantEvents.js';

export interface OperatingHours {
  [key: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

interface TenantProps {
  companyName: CompanyName;
  cnpj: CNPJ;
  plan: Plan;
  planStatus: string;
  ownerUserId: string | null;
  users: User[];
  whatsAppConfig: WhatsAppConfig | null;
  instagramConfig: InstagramConfig | null;
  aiConfig: AIConfig | null;
  businessType: string | null;
  ownerBirthDate: string | null;
  description: string | null;
  services: string | null;
  address: Address | null;
  catalogUrl: string | null;
  catalogFiles: string[];
  operatingHours: OperatingHours | null;
  promotions: Promotion[];
  apiKey: string;
}

export class Tenant extends AggregateRoot<TenantProps> {
  private constructor(
    props: TenantProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return TenantId.create(this._id.toValue());
  }

  get companyName(): CompanyName {
    return this.props.companyName;
  }

  get cnpj(): CNPJ {
    return this.props.cnpj;
  }

  get plan(): Plan {
    return this.props.plan;
  }

  get planStatus(): string {
    return this.props.planStatus;
  }

  get ownerUserId(): string | null {
    return this.props.ownerUserId;
  }

  get users(): User[] {
    return this.props.users;
  }

  get owner(): User | undefined {
    if (!this.props.ownerUserId) {
      return undefined;
    }

    return this.props.users.find(
      (u) => u.id.toValue() === this.props.ownerUserId,
    );
  }

  get whatsAppConfig(): WhatsAppConfig | null {
    return this.props.whatsAppConfig;
  }

  get instagramConfig(): InstagramConfig | null {
    return this.props.instagramConfig;
  }

  get aiConfig(): AIConfig | null {
    return this.props.aiConfig;
  }

  get businessType(): string | null {
    return this.props.businessType;
  }

  get ownerBirthDate(): string | null {
    return this.props.ownerBirthDate;
  }

  get description(): string | null {
    return this.props.description;
  }

  get services(): string | null {
    return this.props.services;
  }

  get address(): Address | null {
    return this.props.address;
  }

  get catalogUrl(): string | null {
    return this.props.catalogUrl;
  }

  get catalogFiles(): string[] {
    return this.props.catalogFiles;
  }

  get operatingHours(): Record<string, unknown> | null {
    return this.props.operatingHours;
  }

  get promotions(): Promotion[] {
    return this.props.promotions;
  }

  get apiKey(): string {
    return this.props.apiKey;
  }

  public static create(
    props: Omit<
      TenantProps,
      | 'whatsAppConfig'
      | 'instagramConfig'
      | 'aiConfig'
      | 'ownerUserId'
      | 'businessType'
      | 'ownerBirthDate'
      | 'description'
      | 'services'
      | 'address'
      | 'catalogUrl'
      | 'catalogFiles'
      | 'operatingHours'
      | 'promotions'
      | 'apiKey'
      | 'planStatus'
    > & {
      promotions?: Promotion[];
      apiKey?: string;
      ownerPassword?: string;
      isTrial?: boolean;
      planStatus?: string;
    },
    id?: UniqueEntityID,
  ): Tenant {
    const inferredOwnerUserId =
      props.users.find((user) => user.role.value === 'OWNER')?.id.toValue() ??
      null;

    const tenant = new Tenant(
      {
        ...props,
        planStatus: props.planStatus || (props.isTrial ? 'TRIALING' : 'ACTIVE'),
        ownerUserId: inferredOwnerUserId,
        whatsAppConfig: null,
        instagramConfig: null,
        aiConfig: null,
        businessType: null,
        ownerBirthDate: null,
        description: null,
        services: null,
        address: null,
        catalogUrl: null,
        catalogFiles: [],
        operatingHours: null,
        promotions: props.promotions || [],
        apiKey: props.apiKey || randomUUID(),
      },
      id,
    );

    if (!id) {
      const owner = tenant.owner;
      tenant.addDomainEvent(
        new TenantCreated(
          tenant.id,
          tenant.companyName.value,
          tenant.cnpj.value,
          tenant.plan.value,
          owner ? owner.name : 'Unknown',
          owner ? owner.email.value : 'unknown@domain.com',
          owner ? owner.phone.value : '0000000000',
          props.ownerPassword,
          props.isTrial || false,
        ),
      );
    }

    return tenant;
  }

  public static reconstitute(
    props: TenantProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): Tenant {
    return new Tenant(props, id, createdAt, updatedAt);
  }

  public updateBusinessData(data: {
    businessType?: string | null;
    cnpj?: string | null;
    ownerBirthDate?: string | null;
    description?: string | null;
    services?: string | null;
    address?: Address | null;
    catalogUrl?: string | null;
    catalogFiles?: string[] | null;
    operatingHours?: OperatingHours | null;
    promotions?: Promotion[];
  }): void {
    if (data.businessType !== undefined)
      this.props.businessType = data.businessType;
    if (data.cnpj !== undefined && data.cnpj !== null)
      this.props.cnpj = CNPJ.create(data.cnpj);
    if (data.ownerBirthDate !== undefined)
      this.props.ownerBirthDate = data.ownerBirthDate;
    if (data.description !== undefined)
      this.props.description = data.description;
    if (data.services !== undefined) this.props.services = data.services;
    if (data.address !== undefined) this.props.address = data.address;
    if (data.catalogUrl !== undefined) this.props.catalogUrl = data.catalogUrl;
    if (data.catalogFiles !== undefined && data.catalogFiles !== null)
      this.props.catalogFiles = data.catalogFiles;
    if (data.operatingHours !== undefined)
      this.props.operatingHours = data.operatingHours;
    if (data.promotions !== undefined) this.props.promotions = data.promotions;

    this.updatedAt = new Date();
  }

  public configureWhatsApp(config: WhatsAppConfig): void {
    this.props.whatsAppConfig = config;
    this.updatedAt = new Date();
    this.addDomainEvent(new WhatsAppConfigured(this.id, config.whatsappNumber));
  }

  public configureInstagram(config: InstagramConfig): void {
    this.props.instagramConfig = config;
    this.updatedAt = new Date();
    this.addDomainEvent(
      new InstagramConfigured(this.id, config.instagramAccountId),
    );
  }

  public disconnectInstagram(): void {
    this.props.instagramConfig = null;
    this.updatedAt = new Date();
    this.addDomainEvent(new InstagramDisconnected(this.id));
  }

  public configureAI(config: AIConfig): void {
    this.props.aiConfig = config;
    this.updatedAt = new Date();
    this.addDomainEvent(new AIConfigUpdated(this.id));
  }

  public changePlan(newPlan: Plan, newPlanStatus?: string): void {
    const oldPlan = this.props.plan.value;
    this.props.plan = newPlan;
    if (newPlanStatus) {
      this.props.planStatus = newPlanStatus;
    }
    this.updatedAt = new Date();
    this.addDomainEvent(new TenantPlanChanged(this.id, oldPlan, newPlan.value));
  }

  public updatePlanStatus(newPlanStatus: string): void {
    this.props.planStatus = newPlanStatus;
    this.updatedAt = new Date();
  }

  public setOwner(userId: string): void {
    this.props.ownerUserId = userId;
    this.updatedAt = new Date();
  }

  public isWhatsAppConfigured(): boolean {
    return this.props.whatsAppConfig !== null;
  }

  public isAIConfigured(): boolean {
    return this.props.aiConfig !== null;
  }

  public isInstagramConfigured(): boolean {
    return this.props.instagramConfig !== null;
  }
}
