import type { ProposalRecord } from '../types';

function normalizeUrl(value: string) {
  return value.replace(/\/$/, '');
}

function resolvePublicAppBaseUrl() {
  const explicitUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();

  if (explicitUrl) {
    return normalizeUrl(explicitUrl);
  }

  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined') {
      return normalizeUrl(window.location.origin);
    }

    return 'http://localhost:8080';
  }

  if (typeof window !== 'undefined') {
    return normalizeUrl(window.location.origin);
  }

  return '';
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMetadata(metadata: ProposalRecord['metadata']) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function readCommercial(metadata: ProposalRecord['metadata']) {
  const normalized = normalizeMetadata(metadata);
  const commercial =
    normalized?.commercial && typeof normalized.commercial === 'object'
      ? (normalized.commercial as Record<string, unknown>)
      : null;

  return commercial;
}

export function getProposalFinalPrice(proposal: Pick<ProposalRecord, 'metadata'>): number | null {
  const metadata = normalizeMetadata(proposal.metadata);

  if (!metadata) {
    return null;
  }

  const raw =
    metadata.finalPrice ??
    metadata.final_price ??
    metadata.price ??
    metadata.finalAmount ??
    metadata.final_amount;

  return parseNumberValue(raw);
}

export function getProposalDisplayTotal(
  proposal: Pick<ProposalRecord, 'metadata' | 'totalAmount'>,
): number {
  return getProposalFinalPrice(proposal) ?? Number(proposal.totalAmount ?? 0);
}

export function hasProposalFinalPrice(proposal: Pick<ProposalRecord, 'metadata'>): boolean {
  return getProposalFinalPrice(proposal) !== null;
}

export function getProposalPublicLink(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const commercial = readCommercial(proposal.metadata);
  const publicAccess =
    commercial?.publicAccess && typeof commercial.publicAccess === 'object'
      ? (commercial.publicAccess as Record<string, unknown>)
      : null;
  const url = publicAccess?.publicUrl;

  return typeof url === 'string' && url.trim() ? url : null;
}

export function getProposalPublicToken(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const publicUrl = getProposalPublicLink(proposal);

  if (!publicUrl) {
    return null;
  }

  const normalizedUrl = publicUrl.trim();
  const pathMatch =
    normalizedUrl.match(/\/proposal\/([^/?#]+)/i) ??
    normalizedUrl.match(/\/public\/proposals\/([^/?#]+)/i);

  return pathMatch?.[1] ?? null;
}

export function getProposalPublicPath(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const token = getProposalPublicToken(proposal);
  return token ? `/proposal/${token}` : null;
}

export function getResolvedProposalPublicUrl(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const path = getProposalPublicPath(proposal);

  if (!path) {
    return null;
  }

  return `${resolvePublicAppBaseUrl()}${path}`;
}

export function getProposalPaymentStatus(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const commercial = readCommercial(proposal.metadata);
  const payment =
    commercial?.payment && typeof commercial.payment === 'object'
      ? (commercial.payment as Record<string, unknown>)
      : null;
  const status = payment?.status;

  return typeof status === 'string' && status.trim() ? status : null;
}

export function getProposalApprovalStatus(
  proposal: Pick<ProposalRecord, 'metadata'>,
): string | null {
  const commercial = readCommercial(proposal.metadata);
  const approval =
    commercial?.approval && typeof commercial.approval === 'object'
      ? (commercial.approval as Record<string, unknown>)
      : null;
  const status = approval?.status;

  return typeof status === 'string' && status.trim() ? status : null;
}
