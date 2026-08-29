/**
 * Normalized payroll execution summary types.
 *
 * These types define a consistent summary shape for payroll execution results
 * across different client contexts (single payment, batch, contract client).
 *
 * ## Shape Overview
 *
 * - `PayrollExecutionSummary` — aggregate container with status, counts, metadata
 * - `PaymentExecutionOutcome` — individual payment-level result within a summary
 *
 * ## Intended Consumers
 *
 * - UI dashboards that display payroll run results
 * - Audit/logging systems that record execution outcomes
 * - History utilities that track execution runs over time
 * - Application-level orchestration that needs to inspect per-payment results
 *
 * ## Compatibility with History Utilities
 *
 * The `PayrollExecutionSummary.timestamp` field (millisecond epoch) serves as
 * a natural sort key for history utilities. The `results` array preserves
 * individual payment outcomes so history consumers can replay or inspect the
 * full detail of any execution run without requiring separate storage.
 *
 * The `PayrollExecutionOutcome` type deliberately mirrors the fields of
 * `PaymentParams` (recipient, amount, asset) so that consumers can map
 * outcomes back to inputs without additional context.
 */

/**
 * Aggregate status of a payroll execution run.
 *
 * - `"success"`  — every payment in the run completed successfully
 * - `"partial"`  — some payments succeeded, some failed
 * - `"failure"`  — every payment failed
 * - `"pending"`  — one or more payments have not reached a terminal state
 */
export type ExecutionStatus = "success" | "partial" | "failure" | "pending";

/**
 * Individual payment execution outcome within a summary.
 *
 * Mirrors `PaymentParams` fields so consumers can correlate outcomes with
 * inputs without external state.  Optional `txHash` and `publicSignals`
 * carry forward the data from `PaymentResult`.
 */
export interface PaymentExecutionOutcome {
  /** Stellar address of the payment recipient */
  recipient: string;
  /** Payment amount in stroops */
  amount: bigint;
  /** Asset identifier (e.g. "native" or a Soroban token contract ID) */
  asset: string;
  /** Terminal or current status of this individual payment */
  status: "success" | "failure" | "pending";
  /** Transaction hash, present when the payment was submitted on-chain */
  txHash?: string;
  /** Human-readable error description, present when the payment failed */
  error?: string;
  /** Public signals from the ZK proof, present for successful payments */
  publicSignals?: string[];
}

/**
 * Normalized summary of a payroll execution run.
 *
 * Produced by `createExecutionSummary` and consumed by UI layers,
 * audit/logging systems, and history utilities.
 */
export interface PayrollExecutionSummary {
  /** Aggregate status derived from individual outcomes */
  status: ExecutionStatus;
  /** Total number of payment operations in this run */
  totalCount: number;
  /** Number of payments that completed successfully */
  successCount: number;
  /** Number of payments that failed */
  failureCount: number;
  /** Number of payments whose status is not yet known */
  pendingCount: number;
  /** Per-payment outcomes, one entry per attempted payment */
  results: PaymentExecutionOutcome[];
  /** Wall-clock duration of the execution run in milliseconds */
  durationMs: number;
  /** Epoch timestamp (ms) when the summary was created */
  timestamp: number;
  /** Human-readable top-level error, present only when the entire run failed */
  error?: string;
}
