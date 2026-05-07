import { randomUUID } from 'crypto';
import { ProposalTitle } from '../value-objects/ProposalTitle';
import { ProposalItem } from '../value-objects/ProposalItem';
import { ProposalEmptyItemsError } from '../errors/ProposalEmptyItemsError';

export type ProposalStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface ProposalProps {
  id?: string;
  tenantId: string;
  contactId: string;
  userId: string;
  title: ProposalTitle;
  description?: string | null;
  benefits?: string | null;
  items: ProposalItem[];
  totalAmount?: number;
  status?: ProposalStatus;
  validUntil?: Date | null;
  scheduledAt?: Date | null;
  pdfUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Proposal {
  private readonly _props: ProposalProps;

  private constructor(props: ProposalProps) {
    this._props = {
      ...props,
      id: props.id ?? randomUUID(),
      status: props.status ?? 'DRAFT',
      items: props.items ?? [],
      totalAmount: this.calculateTotal(props.items ?? []),
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  public static create(props: ProposalProps): Proposal {
    return new Proposal(props);
  }

  public get id(): string { return this._props.id!; }
  public get tenantId(): string { return this._props.tenantId; }
  public get contactId(): string { return this._props.contactId; }
  public get userId(): string { return this._props.userId; }
  public get title(): string { return this._props.title.value; }
  public get description(): string | null | undefined { return this._props.description; }
  public get benefits(): string | null | undefined { return this._props.benefits; }
  public get items(): ProposalItem[] { return [...this._props.items]; }
  public get totalAmount(): number { return this._props.totalAmount!; }
  public get status(): ProposalStatus { return this._props.status!; }
  public get validUntil(): Date | null | undefined { return this._props.validUntil; }
  public get scheduledAt(): Date | null | undefined { return this._props.scheduledAt; }
  public get pdfUrl(): string | null | undefined { return this._props.pdfUrl; }
  public get notes(): string | null | undefined { return this._props.notes; }
  public get metadata(): Record<string, any> | null | undefined { return this._props.metadata; }
  public get createdAt(): Date | undefined { return this._props.createdAt; }
  public get updatedAt(): Date | undefined { return this._props.updatedAt; }

  public updateItems(items: ProposalItem[]): void {
    this._props.items = items;
    this._props.totalAmount = this.calculateTotal(items);
    this._props.updatedAt = new Date();
  }

  public markAsScheduled(date: Date): void {
    if (this._props.items.length === 0) {
      throw new ProposalEmptyItemsError();
    }
    this._props.status = 'SCHEDULED';
    this._props.scheduledAt = date;
    this._props.updatedAt = new Date();
  }

  public setPdfUrl(url: string): void {
    this._props.pdfUrl = url;
    this._props.updatedAt = new Date();
  }

  public setMetadata(metadata: Record<string, any> | null): void {
    this._props.metadata = metadata;
    this._props.updatedAt = new Date();
  }

  public updateStatus(status: ProposalStatus): void {
    this._props.status = status;
    this._props.updatedAt = new Date();
  }

  private calculateTotal(items: ProposalItem[]): number {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  public toJSON() {
    return {
      ...this._props,
      title: this._props.title.value,
      items: this._props.items.map(item => (item as any).props ?? item),
    };
  }
}
