import { IUseCase } from '@shared/application/IUseCase';

export interface PurchaseAddonPackageInput {
  tenantId: string;
}

export interface PurchaseAddonPackageOutput {
  tenantId: string;
  package: {
    messages: number;
    aiTokens: number;
    contacts: number;
    price: number;
  };
  mode: 'CHECKOUT_REQUIRED';
  checkoutUrl: string;
}

export interface IPurchaseAddonPackageUseCase extends IUseCase<
  PurchaseAddonPackageInput,
  PurchaseAddonPackageOutput
> {}

export const IPurchaseAddonPackageUseCase = Symbol(
  'IPurchaseAddonPackageUseCase',
);
