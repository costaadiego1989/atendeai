import { AggregateRoot } from '@shared/domain/AggregateRoot';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectLeadCaptureSource = 'GOOGLE_ADS_LEAD_FORM';
export type ProspectLeadImportStatus =
  | 'NEW'
  | 'IMPORTED'
  | 'REUSED'
  | 'SKIPPED_NO_PHONE';

interface ProspectLeadCaptureProps {
  tenantId: TenantId;
  source: ProspectLeadCaptureSource;
  externalLeadId: string;
  googleAdsCustomerId?: string;
  campaignName?: string;
  formName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  instagramHandle?: string;
  document?: string;
  interests?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  submissionAt: Date;
  importStatus: ProspectLeadImportStatus;
  contactId?: string;
}

export class ProspectLeadCapture extends AggregateRoot<ProspectLeadCaptureProps> {
  private constructor(
    props: ProspectLeadCaptureProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get source(): ProspectLeadCaptureSource {
    return this.props.source;
  }
  get externalLeadId(): string {
    return this.props.externalLeadId;
  }
  get googleAdsCustomerId(): string | undefined {
    return this.props.googleAdsCustomerId;
  }
  get campaignName(): string | undefined {
    return this.props.campaignName;
  }
  get formName(): string | undefined {
    return this.props.formName;
  }
  get fullName(): string | undefined {
    return this.props.fullName;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get email(): string | undefined {
    return this.props.email;
  }
  get city(): string | undefined {
    return this.props.city;
  }
  get state(): string | undefined {
    return this.props.state;
  }
  get instagramHandle(): string | undefined {
    return this.props.instagramHandle;
  }
  get document(): string | undefined {
    return this.props.document;
  }
  get interests(): Record<string, unknown> | undefined {
    return this.props.interests;
  }
  get rawPayload(): Record<string, unknown> | undefined {
    return this.props.rawPayload;
  }
  get submissionAt(): Date {
    return this.props.submissionAt;
  }
  get importStatus(): ProspectLeadImportStatus {
    return this.props.importStatus;
  }
  get contactId(): string | undefined {
    return this.props.contactId;
  }

  public static create(
    props: Omit<ProspectLeadCaptureProps, 'source' | 'importStatus'> & {
      source?: ProspectLeadCaptureSource;
      importStatus?: ProspectLeadImportStatus;
    },
    id?: UniqueEntityID,
  ): ProspectLeadCapture {
    const externalLeadId = props.externalLeadId?.trim();
    if (!externalLeadId) {
      throw new ValidationErrorException(
        'Prospect lead capture external lead id is required',
      );
    }

    return new ProspectLeadCapture(
      {
        tenantId: props.tenantId,
        source: props.source ?? 'GOOGLE_ADS_LEAD_FORM',
        externalLeadId,
        googleAdsCustomerId: props.googleAdsCustomerId?.trim() || undefined,
        campaignName: props.campaignName?.trim() || undefined,
        formName: props.formName?.trim() || undefined,
        fullName: props.fullName?.trim() || undefined,
        phone: props.phone?.trim() || undefined,
        email: props.email?.trim() || undefined,
        city: props.city?.trim() || undefined,
        state: props.state?.trim() || undefined,
        instagramHandle: props.instagramHandle?.trim() || undefined,
        document: props.document?.trim() || undefined,
        interests: props.interests,
        rawPayload: props.rawPayload,
        submissionAt: props.submissionAt,
        importStatus: props.importStatus ?? 'NEW',
        contactId: props.contactId,
      },
      id,
    );
  }

  public static reconstitute(
    props: ProspectLeadCaptureProps,
    id: UniqueEntityID,
    createdAt: Date,
    updatedAt: Date,
  ): ProspectLeadCapture {
    return new ProspectLeadCapture(props, id, createdAt, updatedAt);
  }

  public markImported(contactId: string): void {
    this.props.importStatus = 'IMPORTED';
    this.props.contactId = contactId;
    this.updatedAt = new Date();
  }

  public markReused(contactId: string): void {
    this.props.importStatus = 'REUSED';
    this.props.contactId = contactId;
    this.updatedAt = new Date();
  }

  public markSkippedNoPhone(): void {
    this.props.importStatus = 'SKIPPED_NO_PHONE';
    this.updatedAt = new Date();
  }
}
