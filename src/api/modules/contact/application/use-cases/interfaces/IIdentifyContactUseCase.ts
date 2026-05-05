export interface IdentifyContactInput {
  tenantId: string;
  phone: string;
  name: string;
}

export interface IdentifyContactOutput {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  stage: string;
  lastInteraction?: Date;
}

export interface IIdentifyContactUseCase {
  execute(input: IdentifyContactInput): Promise<IdentifyContactOutput>;
}

export const IDENTIFY_CONTACT_USE_CASE = Symbol('IIdentifyContactUseCase');
