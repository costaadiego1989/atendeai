import { BASE_URL } from '@/shared/api/client';

export interface PublicProposalItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  description?: string | null;
}

export interface PublicProposalRecord {
  id: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  items: PublicProposalItem[];
  totalAmount?: number | null;
  finalAmount?: number | null;
  validUntil?: string | null;
  status: string;
  approvalStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  signature?: {
    signerName?: string | null;
    signedAt?: string | null;
    hasSignature: boolean;
  };
  payment?: {
    id?: string;
    paymentId?: string;
    url?: string;
    status?: string;
    dueDate?: string;
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        body?.message ||
        `Erro inesperado (${response.status})`,
    );
  }

  return (body?.data ?? body) as T;
}

export const publicProposalsService = {
  async getByToken(token: string): Promise<PublicProposalRecord> {
    const response = await fetch(`${BASE_URL}/public/proposals/${token}`, {
      credentials: 'omit',
    });

    return readJson<PublicProposalRecord>(response);
  },

  async accept(
    token: string,
    payload: { signerName: string; signatureDataUrl: string },
  ): Promise<PublicProposalRecord> {
    const response = await fetch(`${BASE_URL}/public/proposals/${token}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'omit',
    });

    return readJson<PublicProposalRecord>(response);
  },

  async reject(token: string): Promise<PublicProposalRecord> {
    const response = await fetch(`${BASE_URL}/public/proposals/${token}/reject`, {
      method: 'POST',
      credentials: 'omit',
    });

    return readJson<PublicProposalRecord>(response);
  },
};
