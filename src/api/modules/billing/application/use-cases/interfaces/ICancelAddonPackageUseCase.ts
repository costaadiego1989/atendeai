import { IUseCase } from '@shared/application/IUseCase';

export interface CancelAddonPackageInput {
  tenantId: string;
}

export interface CancelAddonPackageOutput {
  tenantId: string;
  status: 'CANCELED';
}

export interface ICancelAddonPackageUseCase extends IUseCase<
  CancelAddonPackageInput,
  CancelAddonPackageOutput
> {}

export const ICancelAddonPackageUseCase = Symbol('ICancelAddonPackageUseCase');
