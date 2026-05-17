import { Inject, Injectable } from '@nestjs/common';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectSearchResultRepository';

export type GenerateProspectSearchReportInput = {
  tenantId: string;
  query?: string;
  statuses?: Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>;
  sources?: Array<'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE'>;
  dateFrom?: string;
  dateTo?: string;
};

export type ProspectSearchReportRow = {
  searchId: string;
  businessTypeQuery: string;
  territory: string;
  source: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  maxResults: number;
  discoveredCount: number;
  actualResultsCount: number;
  whatsappReadyCount: number;
  instagramReadyCount: number;
  emailCount: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerateProspectSearchReportOutput = {
  generatedAt: Date;
  summary: {
    totalSearches: number;
    runningSearches: number;
    completedSearches: number;
    failedSearches: number;
    totalDiscovered: number;
    actualResultsCount: number;
    whatsappReadyCount: number;
    instagramReadyCount: number;
    emailCount: number;
  };
  rows: ProspectSearchReportRow[];
};

@Injectable()
export class GenerateProspectSearchReportUseCase {
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly prospectSearchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_RESULT_REPOSITORY)
    private readonly prospectSearchResultRepository: IProspectSearchResultRepository,
  ) {}

  async execute(
    input: GenerateProspectSearchReportInput,
  ): Promise<GenerateProspectSearchReportOutput> {
    const searches = await this.prospectSearchRepository.findAllByTenant(
      input.tenantId,
    );
    const statusFilters = new Set((input.statuses ?? []).filter(Boolean));
    const sourceFilters = new Set((input.sources ?? []).filter(Boolean));
    const normalizedQuery = input.query?.trim().toLowerCase() ?? '';
    const startAt = this.toStartDate(input.dateFrom);
    const endAt = this.toEndDate(input.dateTo);

    const filteredSearches = searches.filter((search) => {
      const matchesStatus =
        statusFilters.size === 0 || statusFilters.has(search.status.value);
      const matchesSource =
        sourceFilters.size === 0 || sourceFilters.has(search.source.value);
      const matchesQuery =
        !normalizedQuery ||
        [
          search.businessTypeQuery,
          search.city,
          search.state,
          search.neighborhood,
          search.failureReason,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesDate = this.isWithinRange(search.createdAt, startAt, endAt);

      return matchesStatus && matchesSource && matchesQuery && matchesDate;
    });

    const rows = await Promise.all(
      filteredSearches.map(async (search) => {
        const results =
          await this.prospectSearchResultRepository.findAllBySearch(
            input.tenantId,
            search.id.toString(),
          );

        return {
          searchId: search.id.toString(),
          businessTypeQuery: search.businessTypeQuery,
          territory: [search.neighborhood, search.city, search.state]
            .filter(Boolean)
            .join(' / '),
          source: search.source.value,
          status: search.status.value,
          maxResults: search.maxResults,
          discoveredCount: search.discoveredCount,
          actualResultsCount: results.length,
          whatsappReadyCount: results.filter((item) =>
            Boolean(item.whatsappPhone),
          ).length,
          instagramReadyCount: results.filter((item) =>
            Boolean(item.instagramUrl),
          ).length,
          emailCount: results.filter((item) => Boolean(item.email)).length,
          failureReason: search.failureReason,
          createdAt: search.createdAt.toISOString(),
          updatedAt: search.updatedAt.toISOString(),
        } satisfies ProspectSearchReportRow;
      }),
    );

    return {
      generatedAt: new Date(),
      summary: {
        totalSearches: rows.length,
        runningSearches: rows.filter(
          (row) => row.status === 'PENDING' || row.status === 'RUNNING',
        ).length,
        completedSearches: rows.filter((row) => row.status === 'COMPLETED')
          .length,
        failedSearches: rows.filter((row) => row.status === 'FAILED').length,
        totalDiscovered: rows.reduce(
          (total, row) => total + row.discoveredCount,
          0,
        ),
        actualResultsCount: rows.reduce(
          (total, row) => total + row.actualResultsCount,
          0,
        ),
        whatsappReadyCount: rows.reduce(
          (total, row) => total + row.whatsappReadyCount,
          0,
        ),
        instagramReadyCount: rows.reduce(
          (total, row) => total + row.instagramReadyCount,
          0,
        ),
        emailCount: rows.reduce((total, row) => total + row.emailCount, 0),
      },
      rows,
    };
  }

  private toStartDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private toEndDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    return new Date(`${value}T23:59:59.999Z`);
  }

  private isWithinRange(value: Date, startAt: Date | null, endAt: Date | null) {
    if (startAt && value < startAt) {
      return false;
    }
    if (endAt && value > endAt) {
      return false;
    }
    return true;
  }
}
