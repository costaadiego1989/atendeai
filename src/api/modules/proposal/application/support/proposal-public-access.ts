import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Proposal } from '@modules/proposal/domain/entities/Proposal';

export type ProposalAcceptanceStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface ProposalPublicAccessMetadata {
  tokenId: string;
  publicUrl?: string;
  conversationId?: string | null;
  messageId?: string | null;
  sentAt?: string | null;
}

export interface ProposalApprovalMetadata {
  status: ProposalAcceptanceStatus;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  signerName?: string | null;
  signatureDataUrl?: string | null;
  signedAt?: string | null;
}

export interface ProposalPaymentMetadata {
  id?: string;
  paymentId?: string;
  url?: string;
  status?: string;
  dueDate?: string;
  confirmedAt?: string | null;
}

export interface ProposalCommercialMetadata {
  publicAccess: ProposalPublicAccessMetadata;
  approval: ProposalApprovalMetadata;
  payment?: ProposalPaymentMetadata;
}

export interface ProposalMetadataShape extends Record<string, unknown> {
  finalPrice?: number;
  commercial: ProposalCommercialMetadata;
}

type ProposalTokenPayload = {
  proposalId: string;
  tokenId: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function normalizeProposalMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ProposalMetadataShape {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? ({ ...metadata } as ProposalMetadataShape)
    : ({} as ProposalMetadataShape);

  const commercialSource =
    base.commercial && typeof base.commercial === 'object' && !Array.isArray(base.commercial)
      ? (base.commercial as ProposalCommercialMetadata)
      : undefined;

  const publicAccessSource =
    commercialSource?.publicAccess &&
    typeof commercialSource.publicAccess === 'object' &&
    !Array.isArray(commercialSource.publicAccess)
      ? commercialSource.publicAccess
      : undefined;

  const approvalSource =
    commercialSource?.approval &&
    typeof commercialSource.approval === 'object' &&
    !Array.isArray(commercialSource.approval)
      ? commercialSource.approval
      : undefined;

  const paymentSource =
    commercialSource?.payment &&
    typeof commercialSource.payment === 'object' &&
    !Array.isArray(commercialSource.payment)
      ? commercialSource.payment
      : undefined;

  return {
    ...base,
    commercial: {
      publicAccess: {
        tokenId: publicAccessSource?.tokenId || randomUUID(),
        publicUrl: publicAccessSource?.publicUrl,
        conversationId: publicAccessSource?.conversationId ?? null,
        messageId: publicAccessSource?.messageId ?? null,
        sentAt: publicAccessSource?.sentAt ?? null,
      },
      approval: {
        status: approvalSource?.status || 'PENDING',
        acceptedAt: approvalSource?.acceptedAt ?? null,
        rejectedAt: approvalSource?.rejectedAt ?? null,
        signerName: approvalSource?.signerName ?? null,
        signatureDataUrl: approvalSource?.signatureDataUrl ?? null,
        signedAt: approvalSource?.signedAt ?? null,
      },
      payment: paymentSource
        ? {
            id: paymentSource.id,
            paymentId: paymentSource.paymentId,
            url: paymentSource.url,
            status: paymentSource.status,
            dueDate: paymentSource.dueDate,
            confirmedAt: paymentSource.confirmedAt ?? null,
          }
        : undefined,
    },
  };
}

export function buildProposalPublicToken(
  payload: ProposalTokenPayload,
  secret: string,
): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyProposalPublicToken(
  token: string,
  secret: string,
): ProposalTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as ProposalTokenPayload;
    if (
      typeof parsed?.proposalId !== 'string' ||
      !parsed.proposalId.trim() ||
      typeof parsed?.tokenId !== 'string' ||
      !parsed.tokenId.trim()
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function resolveProposalFinalAmount(proposal: Proposal): number {
  const metadata = normalizeProposalMetadata(proposal.metadata);
  const finalPrice =
    typeof metadata.finalPrice === 'number' && Number.isFinite(metadata.finalPrice)
      ? metadata.finalPrice
      : null;

  return finalPrice != null && finalPrice > 0
    ? Number(finalPrice.toFixed(2))
    : Number(proposal.totalAmount.toFixed(2));
}
