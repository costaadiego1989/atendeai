import { IUseCase } from '@shared/application/IUseCase';

export interface ListContactsInput {
  tenantId: string;
  branchId?: string;
  page?: number;
  limit?: number;
  stage?: string;
  tag?: string;
}

export interface ListContactsOutput {
  data: {
    id: string;
    branchId?: string;
    name: string;
    phone: string;
    document?: string;
    stage: string;
    tags: string[];
    lastInteraction?: Date;
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IListContactsUseCase extends IUseCase<
  ListContactsInput,
  ListContactsOutput
> {}
export const IListContactsUseCase = Symbol('IListContactsUseCase');
