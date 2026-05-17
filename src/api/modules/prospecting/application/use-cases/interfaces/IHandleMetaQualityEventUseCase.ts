import { IUseCase } from '@shared/application/IUseCase';

export interface HandleMetaQualityEventInput {
  phone: string;
}

export interface HandleMetaQualityEventOutput {
  processed: number;
}

export interface IHandleMetaQualityEventUseCase extends IUseCase<
  HandleMetaQualityEventInput,
  HandleMetaQualityEventOutput
> {}

export const IHandleMetaQualityEventUseCase = Symbol(
  'IHandleMetaQualityEventUseCase',
);
