export { simulatePayroll } from "./simulatePayroll";
export type {
  SimulationFinding,
  SimulationInput,
  SimulationOptions,
  SimulationResult,
  SimulationStatus,
} from "./types";

// ── End-to-end payroll simulation ──────────────────────────────────────────
export { PayrollSimulator } from "./PayrollSimulator";
export { generateCommitments, computeTotalCommitment } from "./commitmentGenerator";
export { createMockProofGenerator, validateProofConfig } from "./proofSimulator";
export { checkTreasury, checkSinglePayment } from "./treasury";
export type { TreasuryCheckResult } from "./treasury";
export { buildSimulatedTransaction, simulatePolling } from "./transactionSimulator";
export type { SimulatedTransaction } from "./transactionSimulator";
export { buildReconciliation } from "./reconciliation";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  SimulationCompanyConfig,
  SimulationEmployeeRecord,
  PayrollPeriodMetadata,
  MockTreasuryState,
  SimulationNetworkSettings,
  ProofSimulationConfig,
  TransactionSimulationConfig,
  PayrollSimulationConfig,
  SalaryCommitment,
  SimulatedPaymentStatus,
  SimulatedPaymentOutcome,
  ReconciliationEntry,
  ReconciliationSummary,
  PayrollSimulationResult,
} from "./types";

export { SimulationErrorCode } from "./types";
