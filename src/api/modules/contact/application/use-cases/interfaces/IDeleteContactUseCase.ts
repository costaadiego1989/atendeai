export interface DeleteContactInput {
  tenantId: string;
  contactId: string;
}

export interface IDeleteContactUseCase {
  execute(input: DeleteContactInput): Promise<void>;
}

export const IDeleteContactUseCase = Symbol('IDeleteContactUseCase');
