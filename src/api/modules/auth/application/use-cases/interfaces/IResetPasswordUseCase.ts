import { IUseCase } from '@shared/application/IUseCase';
import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface ResetPasswordInput {
  token: string;
  password: string;
  context?: AuthRequestContext;
}

export interface ResetPasswordOutput {
  message: string;
}

export interface IResetPasswordUseCase extends IUseCase<
  ResetPasswordInput,
  ResetPasswordOutput
> {}

export const IResetPasswordUseCase = Symbol('IResetPasswordUseCase');
