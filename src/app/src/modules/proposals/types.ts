export type ProposalStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ProposalItemRecord {
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
  subtotal?: number;
}

export interface ProposalRecord {
  id: string;
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  items: ProposalItemRecord[];
  totalAmount: number;
  status: ProposalStatus;
  validUntil?: string | null;
  scheduledAt?: string | null;
  pdfUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalItemDraft {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  description: string;
}

export interface ProposalFormState {
  contactId: string;
  title: string;
  description: string;
  benefits: string;
  validUntil: string;
  finalPrice: string;
  items: ProposalItemDraft[];
}

export function createProposalItemDraft(): ProposalItemDraft {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    quantity: '1',
    unitPrice: '',
    description: '',
  };
}

export function createProposalFormState(): ProposalFormState {
  return {
    contactId: '',
    title: '',
    description: '',
    benefits: '',
    validUntil: '',
    finalPrice: '',
    items: [createProposalItemDraft()],
  };
}
