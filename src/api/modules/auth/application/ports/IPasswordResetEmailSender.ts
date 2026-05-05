export interface IPasswordResetEmailSender {
  send(input: {
    email: string;
    name: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<void>;
}

export const PASSWORD_RESET_EMAIL_SENDER = Symbol(
  'PASSWORD_RESET_EMAIL_SENDER',
);
