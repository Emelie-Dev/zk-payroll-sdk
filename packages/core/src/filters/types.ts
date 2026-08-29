export type PayrollStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface HistoryFilter {
  employeeIds?: string[];
  periodStart?: string;
  periodEnd?: string;
  assets?: string[];
  statuses?: PayrollStatus[];
  pagination?: PaginationOptions;
}

export interface HistoryQuery {
  filter: HistoryFilter;
  toParams(): Record<string, string | string[] | number | undefined>;
}
