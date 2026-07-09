export interface SchedulingMetrics {
  occupancyRate: number;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  noShows: number;
  cancellations: number;
  nextAppointments: Array<{
    time: string;
    clientName: string;
    service: string;
    professional?: string;
  }>;
  comparisonPrevious?: {
    occupancyRate: number;
    percentChange: number;
  };
}

export interface ISchedulingMetricsProvider {
  getMetrics(
    tenantId: string,
    period: string,
  ): Promise<SchedulingMetrics>;
}

export const SCHEDULING_METRICS_PROVIDER = Symbol('SCHEDULING_METRICS_PROVIDER');
