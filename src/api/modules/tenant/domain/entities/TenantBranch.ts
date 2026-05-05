import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { Address } from '../value-objects/Address.js';
import { OperatingHours } from './Tenant.js';

interface TenantBranchProps {
  tenantId: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  whatsappNumber: string | null;
  instagramAccountId: string | null;
  whatsAppConfigOverride:
    | {
        provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
        credentials: Record<string, string>;
        webhookSecret?: string | null;
      }
    | null;
  address: Address | null;
  operatingHours: OperatingHours | null;
  isHeadquarters: boolean;
  active: boolean;
}

export class TenantBranch {
  private constructor(
    private readonly props: TenantBranchProps,
    private readonly _id: UniqueEntityID,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get id(): UniqueEntityID {
    return this._id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get cnpj(): string | null {
    return this.props.cnpj;
  }

  get email(): string | null {
    return this.props.email;
  }

  get whatsappNumber(): string | null {
    return this.props.whatsappNumber;
  }

  get instagramAccountId(): string | null {
    return this.props.instagramAccountId;
  }

  get whatsAppConfigOverride():
    | {
        provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
        credentials: Record<string, string>;
        webhookSecret?: string | null;
      }
    | null {
    return this.props.whatsAppConfigOverride
      ? {
          provider: this.props.whatsAppConfigOverride.provider,
          credentials: { ...this.props.whatsAppConfigOverride.credentials },
          webhookSecret: this.props.whatsAppConfigOverride.webhookSecret ?? null,
        }
      : null;
  }

  get address(): Address | null {
    return this.props.address;
  }

  get operatingHours(): OperatingHours | null {
    return this.props.operatingHours;
  }

  get isHeadquarters(): boolean {
    return this.props.isHeadquarters;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(
    props: TenantBranchProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): TenantBranch {
    if (!props.name || props.name.trim().length < 2) {
      throw new Error('Branch name must have at least 2 characters');
    }

    return new TenantBranch(
      {
        ...props,
        name: props.name.trim(),
        cnpj: props.cnpj?.replace(/\D/g, '') || null,
        phone: props.phone?.trim() || null,
        email: props.email?.trim() || null,
        whatsappNumber: props.whatsappNumber?.trim() || null,
        instagramAccountId: props.instagramAccountId?.trim() || null,
        whatsAppConfigOverride:
          props.whatsAppConfigOverride &&
          Object.keys(props.whatsAppConfigOverride.credentials ?? {}).length > 0
            ? {
                provider: props.whatsAppConfigOverride.provider,
                credentials: { ...props.whatsAppConfigOverride.credentials },
                webhookSecret:
                  props.whatsAppConfigOverride.webhookSecret?.trim() || null,
              }
            : null,
        operatingHours: props.operatingHours ?? null,
      },
      id ?? new UniqueEntityID(),
      createdAt ?? new Date(),
      updatedAt ?? new Date(),
    );
  }
}
