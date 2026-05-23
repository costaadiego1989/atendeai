export interface WidgetSessionData {
  id: string;
  widgetConfigId: string;
  tenantId: string;
  contactId: string | null;
  conversationId: string | null;
  visitorId: string;
  visitorName: string | null;
  visitorPhone: string | null;
  visitorEmail: string | null;
  visitorCpf: string | null;
  pageUrl: string | null;
  status: string;
  lastActiveAt: Date;
  createdAt: Date;
}

export interface CreateWidgetSessionData {
  widgetConfigId: string;
  tenantId: string;
  visitorId: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCpf?: string | null;
  pageUrl?: string | null;
}

export interface UpdateWidgetSessionData {
  contactId?: string | null;
  conversationId?: string | null;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCpf?: string | null;
  pageUrl?: string | null;
  status?: string;
  lastActiveAt?: Date;
}

export interface IWidgetSessionRepository {
  findActiveByVisitor(
    widgetConfigId: string,
    tenantId: string,
    visitorId: string,
  ): Promise<WidgetSessionData | null>;
  findById(id: string, tenantId: string): Promise<WidgetSessionData | null>;
  create(data: CreateWidgetSessionData): Promise<WidgetSessionData>;
  update(id: string, tenantId: string, data: UpdateWidgetSessionData): Promise<WidgetSessionData>;
  close(id: string, tenantId: string): Promise<void>;
}

export const WIDGET_SESSION_REPOSITORY = Symbol('IWidgetSessionRepository');
