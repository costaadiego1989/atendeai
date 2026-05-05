export interface GetContactInput {
  tenantId: string;
  contactId: string;
}

export interface GetContactOutput {
  id: string;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage: string;
  tags: string[];
  notes?: string;
  lastInteraction: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGetContactUseCase {
  execute(input: GetContactInput): Promise<GetContactOutput>;
}

export const IGetContactUseCase = Symbol('IGetContactUseCase');
