import { IUseCase } from '@shared/application/IUseCase';
import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface ChangeFirstAccessPasswordInput {
  userId: string;
  password: string;
  context?: AuthRequestContext;
}

export interface ChangeFirstAccessPasswordOutput {
  message: string;
}

export interface IChangeFirstAccessPasswordUseCase extends IUseCase<
  ChangeFirstAccessPasswordInput,
  ChangeFirstAccessPasswordOutput
> {}

export const IChangeFirstAccessPasswordUseCase = Symbol(
  'IChangeFirstAccessPasswordUseCase',
);
