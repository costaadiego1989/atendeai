import { Entity } from '@shared/domain/Entity';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ProspectSearchSourceVO } from '../value-objects/ProspectSearchSource';

interface ProspectSearchResultProps {
  tenantId: TenantId;
  searchId: UniqueEntityID;
  source: ProspectSearchSourceVO;
  businessName: string;
  city: string;
  state?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  email?: string;
  website?: string;
  externalId?: string;
}

export class ProspectSearchResult extends Entity<ProspectSearchResultProps> {
  private constructor(
    props: ProspectSearchResultProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get searchId(): UniqueEntityID {
    return this.props.searchId;
  }

  get source(): ProspectSearchSourceVO {
    return this.props.source;
  }

  get businessName(): string {
    return this.props.businessName;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string | undefined {
    return this.props.state;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get whatsappPhone(): string | undefined {
    return this.props.whatsappPhone;
  }

  get instagramUrl(): string | undefined {
    return this.props.instagramUrl;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get website(): string | undefined {
    return this.props.website;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }

  public static reconstitute(
    props: ProspectSearchResultProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): ProspectSearchResult {
    return new ProspectSearchResult(props, id, createdAt, updatedAt);
  }

  public static create(props: ProspectSearchResultProps, id?: UniqueEntityID) {
    const businessName = props.businessName?.trim();
    const city = props.city?.trim();

    if (!businessName) {
      throw new ValidationErrorException(
        'Prospect search result requires a business name',
      );
    }

    if (!city) {
      throw new ValidationErrorException(
        'Prospect search result requires a city',
      );
    }

    return new ProspectSearchResult(
      {
        ...props,
        businessName,
        city,
        state: props.state?.trim() || undefined,
        phone: props.phone?.trim() || undefined,
        whatsappPhone: props.whatsappPhone?.trim() || undefined,
        instagramUrl: props.instagramUrl?.trim() || undefined,
        email: props.email?.trim() || undefined,
        website: props.website?.trim() || undefined,
        externalId: props.externalId?.trim() || undefined,
      },
      id,
    );
  }
}
