import { HistoryFilter, HistoryQuery, PaginationOptions, PayrollStatus } from "./types";

/**
 * Fluent builder for composing typed payroll history queries.
 *
 * Filters compose additively — each call narrows the result set.
 * Call build() to get an immutable HistoryQuery ready for your API layer.
 *
 * @example
 * const query = new HistoryFilterBuilder()
 *   .forEmployees(["emp_1", "emp_2"])
 *   .forPeriod("2024-01-01", "2024-03-31")
 *   .withStatuses(["completed"])
 *   .paginate({ page: 1, limit: 25 })
 *   .build();
 */
export class HistoryFilterBuilder {
  private filter: HistoryFilter = {};

  forEmployees(ids: string[]): this {
    this.filter.employeeIds = [...(this.filter.employeeIds ?? []), ...ids];
    return this;
  }

  forEmployee(id: string): this {
    return this.forEmployees([id]);
  }

  forPeriod(start: string, end: string): this {
    this.filter.periodStart = start;
    this.filter.periodEnd = end;
    return this;
  }

  periodFrom(start: string): this {
    this.filter.periodStart = start;
    return this;
  }

  periodTo(end: string): this {
    this.filter.periodEnd = end;
    return this;
  }

  withAssets(assets: string[]): this {
    this.filter.assets = [...(this.filter.assets ?? []), ...assets];
    return this;
  }

  withAsset(asset: string): this {
    return this.withAssets([asset]);
  }

  withStatuses(statuses: PayrollStatus[]): this {
    this.filter.statuses = [...(this.filter.statuses ?? []), ...statuses];
    return this;
  }

  withStatus(status: PayrollStatus): this {
    return this.withStatuses([status]);
  }

  paginate(options: PaginationOptions): this {
    this.filter.pagination = { ...this.filter.pagination, ...options };
    return this;
  }

  reset(): this {
    this.filter = {};
    return this;
  }

  build(): HistoryQuery {
    const snapshot: HistoryFilter = JSON.parse(JSON.stringify(this.filter));
    return {
      filter: snapshot,
      toParams() {
        const params: Record<string, string | string[] | number | undefined> = {};

        if (snapshot.employeeIds?.length) params.employeeIds = snapshot.employeeIds;
        if (snapshot.periodStart) params.periodStart = snapshot.periodStart;
        if (snapshot.periodEnd) params.periodEnd = snapshot.periodEnd;
        if (snapshot.assets?.length) params.assets = snapshot.assets;
        if (snapshot.statuses?.length) params.statuses = snapshot.statuses;
        if (snapshot.pagination?.page !== undefined) params.page = snapshot.pagination.page;
        if (snapshot.pagination?.limit !== undefined) params.limit = snapshot.pagination.limit;
        if (snapshot.pagination?.cursor) params.cursor = snapshot.pagination.cursor;

        return params;
      },
    };
  }
}

/**
 * Shorthand factories for common single-dimension filters.
 */
export const PayrollHistoryFilters = {
  byEmployee(id: string): HistoryQuery {
    return new HistoryFilterBuilder().forEmployee(id).build();
  },

  byEmployees(ids: string[]): HistoryQuery {
    return new HistoryFilterBuilder().forEmployees(ids).build();
  },

  byPeriod(start: string, end: string): HistoryQuery {
    return new HistoryFilterBuilder().forPeriod(start, end).build();
  },

  byStatus(status: PayrollStatus): HistoryQuery {
    return new HistoryFilterBuilder().withStatus(status).build();
  },

  byStatuses(statuses: PayrollStatus[]): HistoryQuery {
    return new HistoryFilterBuilder().withStatuses(statuses).build();
  },

  byAsset(asset: string): HistoryQuery {
    return new HistoryFilterBuilder().withAsset(asset).build();
  },
};
