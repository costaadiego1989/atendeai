import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
  RecoveryCaseRecord,
} from '../../domain/ports/IRecoveryRepository';

export interface GenerateRecoveryReportQuery {
  tenantId: string;
  branchId?: string;
  statuses?: string[];
  sources?: string[];
  search?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

export interface GenerateRecoveryReportOutput {
  generatedAt: Date;
  summary: {
    totalCases: number;
    openCases: number;
    promiseCases: number;
    paidCases: number;
    guidanceCases: number;
    openAmount: number;
    paidAmount: number;
  };
  items: RecoveryCaseRecord[];
}

@Injectable()
export class GenerateRecoveryReportUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
  ) {}

  async execute(
    query: GenerateRecoveryReportQuery,
  ): Promise<GenerateRecoveryReportOutput> {
    const cases = await this.recoveryRepository.listCases({
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
    });
    const filteredCases = this.applySearch(
      cases.filter((item) => this.matchesFilters(item, query)),
      query.search,
    );
    const openCases = filteredCases.filter(
      (item) => item.status !== 'PAID' && item.status !== 'STOPPED',
    );
    const paidCases = filteredCases.filter((item) => item.status === 'PAID');
    const promiseCases = filteredCases.filter(
      (item) => item.status === 'PROMISE_TO_PAY',
    );
    const guidanceCases = filteredCases.filter((item) =>
      Boolean(item.suggestedReply),
    );

    return {
      generatedAt: new Date(),
      summary: {
        totalCases: filteredCases.length,
        openCases: openCases.length,
        promiseCases: promiseCases.length,
        paidCases: paidCases.length,
        guidanceCases: guidanceCases.length,
        openAmount: openCases.reduce(
          (total, item) => total + Number(item.amountDue ?? 0),
          0,
        ),
        paidAmount: paidCases.reduce(
          (total, item) => total + Number(item.amountDue ?? 0),
          0,
        ),
      },
      items: filteredCases,
    };
  }

  private applySearch(
    cases: RecoveryCaseRecord[],
    search?: string,
  ): RecoveryCaseRecord[] {
    const normalizedSearch = search?.trim().toLowerCase();
    if (!normalizedSearch) {
      return cases;
    }

    return cases.filter((item) =>
      [
        item.debtorName,
        item.debtorCompanyName,
        item.phone,
        item.chargeTitle,
        item.chargeDescription,
        item.relatedEntityLabel,
        item.externalReference,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }

  private matchesFilters(
    item: RecoveryCaseRecord,
    query: GenerateRecoveryReportQuery,
  ) {
    const statuses = new Set((query.statuses ?? []).filter(Boolean));
    const sources = new Set((query.sources ?? []).filter(Boolean));

    const matchesStatus = statuses.size === 0 || statuses.has(item.status);
    const matchesSource = sources.size === 0 || sources.has(item.source);

    return matchesStatus && matchesSource;
  }
}
