export interface WidgetConfigData {
  id: string;
  tenantId: string;
  enabled: boolean;
  publicToken: string;
  name: string;
  greeting: string | null;
  color: string;
  backgroundColor: string | null;
  position: string;
  avatarUrl: string | null;
  collectName: boolean;
  collectPhone: boolean;
  collectEmail: boolean;
  collectCpf: boolean;
  proactiveDelay: number | null;
  proactiveMsg: string | null;
  quickReplies: string[];
  allowedOrigins: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWidgetConfigData {
  tenantId: string;
  name?: string;
  enabled?: boolean;
  greeting?: string | null;
  color?: string;
  position?: string;
  avatarUrl?: string | null;
  collectName?: boolean;
  collectPhone?: boolean;
  collectEmail?: boolean;
  collectCpf?: boolean;
  proactiveDelay?: number | null;
  proactiveMsg?: string | null;
  quickReplies?: string[];
}

export interface UpdateWidgetConfigData {
  name?: string;
  enabled?: boolean;
  greeting?: string | null;
  color?: string;
  backgroundColor?: string | null;
  position?: string;
  avatarUrl?: string | null;
  collectName?: boolean;
  collectPhone?: boolean;
  collectEmail?: boolean;
  collectCpf?: boolean;
  proactiveDelay?: number | null;
  proactiveMsg?: string | null;
  quickReplies?: string[];
}

export interface IWidgetConfigRepository {
  findByPublicToken(publicToken: string): Promise<WidgetConfigData | null>;
  findByTenantId(tenantId: string): Promise<WidgetConfigData | null>;
  findOrCreate(tenantId: string): Promise<WidgetConfigData>;
  update(
    id: string,
    tenantId: string,
    data: UpdateWidgetConfigData,
  ): Promise<WidgetConfigData>;
  upsertByTenantId(
    tenantId: string,
    data: UpdateWidgetConfigData,
  ): Promise<WidgetConfigData>;
  updateAvatar(tenantId: string, avatarUrl: string): Promise<WidgetConfigData>;
}

export const WIDGET_CONFIG_REPOSITORY = Symbol('IWidgetConfigRepository');
