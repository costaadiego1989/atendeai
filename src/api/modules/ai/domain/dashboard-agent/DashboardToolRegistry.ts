import { Injectable } from '@nestjs/common';

export type DashboardToolId =
  | 'sales_metrics'
  | 'attendance_status'
  | 'scheduling'
  | 'catalog_inventory'
  | 'recovery_status'
  | 'contacts_crm';

@Injectable()
export class DashboardToolRegistry {
  private readonly nicheToolMap: Record<string, DashboardToolId[]> = {
    ECOMMERCE: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    FOOD: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'contacts_crm'],
    BAKERY: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'contacts_crm'],
    CAFETERIA: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'contacts_crm'],
    RETAIL: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    SUPERMARKET: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    MARKET: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    GROCERY: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    CLINIC: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    HEALTH: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    SCHEDULING: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    SALON: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    BEAUTY: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    GYM: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    LEGAL: ['attendance_status', 'scheduling', 'contacts_crm'],
    REALESTATE: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    RECOVERY: ['sales_metrics', 'attendance_status', 'recovery_status', 'contacts_crm'],
    B2B: ['sales_metrics', 'attendance_status', 'scheduling', 'recovery_status', 'contacts_crm'],
    AGENCY: ['sales_metrics', 'attendance_status', 'scheduling', 'recovery_status', 'contacts_crm'],
    AUTOMOTIVE: ['sales_metrics', 'attendance_status', 'scheduling', 'catalog_inventory', 'contacts_crm'],
    HOSPITALITY: ['sales_metrics', 'attendance_status', 'scheduling', 'catalog_inventory', 'contacts_crm'],
    PET: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    EDUCATION: ['attendance_status', 'scheduling', 'contacts_crm'],
    RENTAL: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    SIMPLE_SERVICE: ['sales_metrics', 'attendance_status', 'contacts_crm'],
    GENERIC: ['sales_metrics', 'attendance_status', 'contacts_crm'],
    OTHER: ['sales_metrics', 'attendance_status', 'contacts_crm'],
  };

  getToolIdsForNiche(businessType: string | null | undefined): DashboardToolId[] {
    const normalized = (businessType || 'GENERIC').toUpperCase();
    return this.nicheToolMap[normalized] || this.nicheToolMap['GENERIC'];
  }

  getAllToolIds(): DashboardToolId[] {
    return ['sales_metrics', 'attendance_status', 'scheduling', 'catalog_inventory', 'recovery_status', 'contacts_crm'];
  }

  isToolAvailableForNiche(toolId: DashboardToolId, businessType: string): boolean {
    return this.getToolIdsForNiche(businessType).includes(toolId);
  }
}
