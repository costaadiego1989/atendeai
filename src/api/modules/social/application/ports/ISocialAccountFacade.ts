export interface ConnectSocialAccountInput {
  tenantId: string;
  platform: string;
  externalAccountId: string;
  accessToken: string;
  pageId: string;
  username?: string | null;
  displayName?: string | null;
  profilePictureUrl?: string | null;
}

export interface ISocialAccountFacade {
  connectAccount(input: ConnectSocialAccountInput): Promise<{ id: string }>;
}

export const SOCIAL_ACCOUNT_FACADE = 'SOCIAL_ACCOUNT_FACADE';
