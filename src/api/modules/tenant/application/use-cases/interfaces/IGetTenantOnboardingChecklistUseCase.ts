export interface TenantOnboardingChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface GetTenantOnboardingChecklistOutput {
  id: string;
  completionRatio: number;
  items: TenantOnboardingChecklistItem[];
}

export interface IGetTenantOnboardingChecklistUseCase {
  execute(tenantId: string): Promise<GetTenantOnboardingChecklistOutput>;
}

export const IGetTenantOnboardingChecklistUseCase = Symbol(
  'IGetTenantOnboardingChecklistUseCase',
);
