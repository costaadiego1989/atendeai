import { IUseCase } from '@shared/application/IUseCase';
import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface RequestPasswordResetInput {
  email: string;
  context?: AuthRequestContext;
}

export interface RequestPasswordResetOutput {
  message: string;
}

export interface IRequestPasswordResetUseCase extends IUseCase<
  RequestPasswordResetInput,
  RequestPasswordResetOutput
> {}

export const IRequestPasswordResetUseCase = Symbol(
  'IRequestPasswordResetUseCase',
);
