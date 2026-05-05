import {
  GoogleAdsConnection,
} from '../types/GoogleAdsConnection';

export interface IGoogleAdsConnectionRepository {
  save(connection: GoogleAdsConnection): Promise<void>;
  findByTenantId(tenantId: string): Promise<GoogleAdsConnection | null>;
  deleteByTenantId(tenantId: string): Promise<void>;
}

export const GOOGLE_ADS_CONNECTION_REPOSITORY = Symbol(
  'IGoogleAdsConnectionRepository',
);
