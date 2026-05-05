import { IUseCase } from '@shared/application/IUseCase';
import { AuthRequestContext } from '../../types/AuthRequestContext';

export interface RefreshTokenInput {
  refreshToken: string;
  context?: AuthRequestContext;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

export interface IRefreshTokenUseCase extends IUseCase<
  RefreshTokenInput,
  RefreshTokenOutput
> {}
export const IRefreshTokenUseCase = Symbol('IRefreshTokenUseCase');
