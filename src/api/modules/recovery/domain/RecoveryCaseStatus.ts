/**
 * Terminal statuses represent cases where no further outreach should occur.
 * Contacting a case in one of these statuses violates opt-out rules (LGPD).
 */
export const TERMINAL_STATUSES = [
  'PAID',
  'STOPPED',
  'INVALID_CONTACT',
  'CANCELLED',
  'FAILED_RECURRING',
] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
