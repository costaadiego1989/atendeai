/**
 * Utility to resolve period filter into concrete date range.
 */
export function resolveDateRange(input: {
  period?: '1d' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
}): { start: Date; end: Date } {
  const now = new Date();
  const end = input.endDate ? new Date(input.endDate) : now;

  if (input.period === 'custom' && input.startDate) {
    return { start: new Date(input.startDate), end };
  }

  const daysMap: Record<string, number> = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  const days = daysMap[input.period ?? '30d'] ?? 30;
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  return { start, end };
}
