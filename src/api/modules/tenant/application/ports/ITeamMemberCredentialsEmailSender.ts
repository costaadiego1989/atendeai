export interface TeamMemberCredentialsEmailInput {
  email: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
  tenantName: string;
}

export interface ITeamMemberCredentialsEmailSender {
  send(input: TeamMemberCredentialsEmailInput): Promise<void>;
}

export const TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER = Symbol(
  'TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER',
);
