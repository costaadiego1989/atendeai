import { IUseCase } from '@shared/application/IUseCase';

export interface GetAddonPackageInfoInput {
  tenantId: string;
}

export interface GetAddonPackageInfoOutput {
  tenantId: string;
  available: boolean;
  active: boolean;
  package: {
    messages: number;
    aiTokens: number;
    contacts: number;
    price: number;
  } | null;
}

export interface IGetAddonPackageInfoUseCase extends IUseCase<
  GetAddonPackageInfoInput,
  GetAddonPackageInfoOutput
> {}

export const IGetAddonPackageInfoUseCase = Symbol(
  'IGetAddonPackageInfoUseCase',
);
