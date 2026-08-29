/**
 * Fee estimation types for payroll operations.
 */

export type FeeEstimationOperation = "payroll_submission" | "audit_grant" | "treasury_update";

export interface FeeEstimate {
  /** The operation type this estimate is for. */
  operation: FeeEstimationOperation;
  /** Estimated base fee in stroops. */
  baseFee: bigint;
  /** Estimated computational fee in stroops. */
  computationalFee: bigint;
  /** Total estimated fee in stroops. */
  totalFee: bigint;
  /** Number of operations in the transaction. */
  operationCount: number;
  /** Whether this estimate is exact or approximate. */
  exact: boolean;
  /** Human-readable breakdown of the fee components. */
  breakdown: string;
}

export interface FeeEstimationOptions {
  /** Number of employees/payments in the batch (for payroll_submission). Defaults to 1. */
  batchSize?: number;
  /** Number of audit keys to grant (for audit_grant). Defaults to 1. */
  grantCount?: number;
  /** Number of treasury operations (for treasury_update). Defaults to 1. */
  updateCount?: number;
  /** Override base fee in stroops. If omitted, uses the SDK default. */
  baseFeeOverride?: bigint;
}
