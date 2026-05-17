import { IUseCase } from '@shared/application/IUseCase';
import { ContactStage } from '../../../domain/value-objects/ContactStage';

export interface ImportContactsListInput {
  tenantId: string;
  branchId?: string;
  rawText: string;
  defaultStage?:
    | ContactStage
    | 'LEAD'
    | 'PROSPECT'
    | 'OPPORTUNITY'
    | 'CUSTOMER'
    | 'INACTIVE';
  defaultTags?: string[];
}

export interface ImportContactsListOutput {
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: Array<{
    lineNumber: number;
    status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
    name: string;
    phone: string;
    reason?: string;
  }>;
}

export const IImportContactsListUseCase = Symbol('IImportContactsListUseCase');
export interface IImportContactsListUseCase extends IUseCase<
  ImportContactsListInput,
  ImportContactsListOutput
> {}
