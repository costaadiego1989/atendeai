import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface LogoutInput {
  refreshToken?: string;
  context?: AuthRequestContext;
}

export interface ILogoutUseCase {
  execute(input: LogoutInput): Promise<void>;
}

export const ILogoutUseCase = Symbol('ILogoutUseCase');
