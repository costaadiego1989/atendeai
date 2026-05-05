import { OperatingHours } from '../../../domain/entities/Tenant';

export interface UpdateBusinessDataInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  businessType?: string | null;
  ownerBirthDate?: string | null;
  description?: string | null;
  services?: string | null;
  zipcode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  catalogUrl?: string | null;
  catalogFiles?: string[] | null;
  operatingHours?: OperatingHours | null;
}

export interface UpdateBusinessDataOutput {
  success: boolean;
}

export interface IUpdateBusinessDataUseCase {
  execute(input: UpdateBusinessDataInput): Promise<UpdateBusinessDataOutput>;
}

export const IUpdateBusinessDataUseCase = Symbol('IUpdateBusinessDataUseCase');
