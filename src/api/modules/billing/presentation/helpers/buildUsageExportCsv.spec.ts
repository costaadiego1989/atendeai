import { buildUsageExportCsv } from './buildUsageExportCsv';
import type { GetUsageOutput } from '../../application/use-cases/interfaces/IGetUsageUseCase';

describe('buildUsageExportCsv', () => {
  it('monta BOM, cabecalhos e valores escapados', () => {
    const data: GetUsageOutput = {
      tenantId: 't-a',
      plan: 'PRO',
      scheduledPlan: 'ESCALA',
      currentPeriod: {
        start: new Date('2026-05-01T00:00:00.000Z'),
        end: new Date('2026-06-01T00:00:00.000Z'),
      },
      usage: {
        messages: { used: 12, quota: 100 },
        aiTokens: { used: 0, quota: 50 },
        contacts: { used: 1, quota: 2 },
      },
    };
    const csv = buildUsageExportCsv(data);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('tenant_id,plan');
    expect(csv).toContain('t-a,PRO');
  });
});
