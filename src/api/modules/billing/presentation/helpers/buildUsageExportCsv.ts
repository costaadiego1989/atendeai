import type { GetUsageOutput } from '../../application/use-cases/interfaces/IGetUsageUseCase';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : String(value ?? '');
  const needsQuote = /[",\r\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function buildUsageExportCsv(data: GetUsageOutput): string {
  const hdr = [
    'tenant_id',
    'plan',
    'scheduled_plan',
    'period_start',
    'period_end',
    'messages_used',
    'messages_quota',
    'ai_tokens_used',
    'ai_tokens_quota',
    'contacts_used',
    'contacts_quota',
  ].join(',');

  const row = [
    csvCell(data.tenantId),
    csvCell(data.plan),
    csvCell(data.scheduledPlan ?? ''),
    csvCell(data.currentPeriod.start?.toISOString()),
    csvCell(data.currentPeriod.end?.toISOString()),
    csvCell(data.usage.messages.used),
    csvCell(data.usage.messages.quota),
    csvCell(data.usage.aiTokens.used),
    csvCell(data.usage.aiTokens.quota),
    csvCell(data.usage.contacts.used),
    csvCell(data.usage.contacts.quota),
  ].join(',');

  return `\ufeff${hdr}\r\n${row}\r\n`;
}
