export interface UpdateContactInput {
  tenantId: string;
  contactId: string;
  name?: string;
  document?: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateContactOutput {
  id: string;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage: string;
  tags: string[];
  notes?: string;
}

export interface IUpdateContactUseCase {
  execute(input: UpdateContactInput): Promise<UpdateContactOutput>;
}

export const IUpdateContactUseCase = Symbol('IUpdateContactUseCase');
