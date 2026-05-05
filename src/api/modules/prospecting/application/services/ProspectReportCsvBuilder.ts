import { Injectable } from '@nestjs/common';
import { GenerateProspectCampaignReportOutput } from '../use-cases/GenerateProspectCampaignReportUseCase';
import { GenerateProspectSearchReportOutput } from '../use-cases/GenerateProspectSearchReportUseCase';

type CsvFile = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class ProspectReportCsvBuilder {
  buildSearches(report: GenerateProspectSearchReportOutput): CsvFile {
    const header = [
      'search_id',
      'business_type_query',
      'territory',
      'source',
      'status',
      'max_results',
      'discovered_count',
      'actual_results_count',
      'whatsapp_ready_count',
      'instagram_ready_count',
      'email_count',
      'failure_reason',
      'created_at',
      'updated_at',
    ];

    const rows = report.rows.map((row) => [
      row.searchId,
      row.businessTypeQuery,
      row.territory,
      row.source,
      row.status,
      String(row.maxResults),
      String(row.discoveredCount),
      String(row.actualResultsCount),
      String(row.whatsappReadyCount),
      String(row.instagramReadyCount),
      String(row.emailCount),
      row.failureReason ?? '',
      row.createdAt,
      row.updatedAt,
    ]);

    return {
      fileName: `prospecting-searches-${report.generatedAt.toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: this.stringify([header, ...rows]),
    };
  }

  buildCampaigns(report: GenerateProspectCampaignReportOutput): CsvFile {
    const header = [
      'campaign_id',
      'name',
      'objective',
      'audience_type',
      'channel',
      'status',
      'daily_limit',
      'target_contacts_count',
      'executions_count',
      'pending_executions',
      'contacted_executions',
      'responded_executions',
      'stopped_executions',
      'failed_executions',
      'created_at',
      'updated_at',
    ];

    const rows = report.rows.map((row) => [
      row.campaignId,
      row.name,
      row.objective,
      row.audienceType,
      row.channel,
      row.status,
      String(row.dailyLimit),
      String(row.targetContactsCount),
      String(row.executionsCount),
      String(row.pendingExecutions),
      String(row.contactedExecutions),
      String(row.respondedExecutions),
      String(row.stoppedExecutions),
      String(row.failedExecutions),
      row.createdAt,
      row.updatedAt,
    ]);

    return {
      fileName: `prospecting-campaigns-${report.generatedAt.toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: this.stringify([header, ...rows]),
    };
  }

  private stringify(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
  }
}
