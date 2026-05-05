import { IUseCase } from '@shared/application/IUseCase';

export interface ConfigureInstagramInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  instagramAccountId: string;
  branchId?: string;
}

export interface ConfigureInstagramOutput {
  id: string;
  instagramAccountId: string;
  status: string;
  configuredAt: Date;
}

export interface IConfigureInstagramUseCase extends IUseCase<
  ConfigureInstagramInput,
  ConfigureInstagramOutput
> {}

export const IConfigureInstagramUseCase = Symbol('IConfigureInstagramUseCase');
