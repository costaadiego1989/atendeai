export type GoogleAdsConnectionStatus =
  | 'NOT_CONNECTED'
  | 'PENDING_ACCOUNT_SELECTION'
  | 'CONNECTED';

export interface GoogleAdsConnection {
  tenantId: string;
  googleEmail?: string;
  refreshToken: string;
  status: GoogleAdsConnectionStatus;
  customerId?: string;
  customerName?: string;
  loginCustomerId?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface GoogleAdsAccessibleAccount {
  customerId: string;
  descriptiveName: string;
  isManager: boolean;
}
