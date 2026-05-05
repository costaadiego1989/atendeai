import { IUseCase } from '@shared/application/IUseCase';

export interface CreateContactInput {
  tenantId: string;
  branchId?: string;
  name: string;
  phone: string;
  document: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface CreateContactOutput {
  id: string;
  tenantId: string;
  branchId?: string;
  name: string;
  phone: string;
  document?: string;
  stage: string;
  tags: string[];
  createdAt: Date;
}

export interface ICreateContactUseCase extends IUseCase<
  CreateContactInput,
  CreateContactOutput
> {}
export const ICreateContactUseCase = Symbol('ICreateContactUseCase');
