import { IUseCase } from '@shared/application/IUseCase';
import { ConfigureWhatsAppOutput } from './IConfigureWhatsAppUseCase';

export interface RefreshMetaWhatsAppStatusInput {
  tenantId: string;
  branchId?: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
}

export type RefreshMetaWhatsAppStatusOutput = ConfigureWhatsAppOutput;

export interface IRefreshMetaWhatsAppStatusUseCase extends IUseCase<
  RefreshMetaWhatsAppStatusInput,
  RefreshMetaWhatsAppStatusOutput
> {}

export const IRefreshMetaWhatsAppStatusUseCase = Symbol(
  'IRefreshMetaWhatsAppStatusUseCase',
);
