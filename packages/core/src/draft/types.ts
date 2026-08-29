export interface PayrollDraftEntry {
  recipientId: string;
  amount: string;
  asset: string;
  note?: string;
}

export interface PayrollDraft {
  version: number;
  createdAt: string;
  updatedAt: string;
  label?: string;
  entries: PayrollDraftEntry[];
}

export interface DraftExportResult {
  data: string;
  checksum: string;
}

export interface DraftImportResult {
  draft: PayrollDraft;
  warnings: string[];
}

// ── DraftBuilder structured feedback types (issue #64) ─────────────────────

/**
 * Stable error codes consumed by review UIs and automated tooling.
 * Mirrors the BatchValidationError code style for consistency.
 */
export type DraftErrorCode =
  "EMPTY_DRAFT" | "INVALID_RECIPIENT" | "INVALID_AMOUNT" | "DUPLICATE_RECIPIENT" | "MISSING_ASSET";

/**
 * Non-blocking review warnings. Drafts with warnings may still be built
 * because review-first workflows should surface issues without blocking
 * serialization of in-progress drafts.
 */
export type DraftWarningCode = "MIXED_ASSETS" | "EMPTY_NOTE" | "LARGE_DRAFT";

export interface DraftValidationError {
  code: DraftErrorCode;
  message: string;
  field: string;
  index?: number;
}

export interface DraftWarning {
  code: DraftWarningCode;
  message: string;
  field?: string;
  index?: number;
}

/**
 * Aggregate result returned by `DraftBuilder.summary()`.
 * Designed for review-before-submit UIs that want both totals and
 * validation feedback in a single object.
 */
export interface DraftSummary {
  entryCount: number;
  uniqueRecipientCount: number;
  /** Per-asset totals, parsed from string amounts. */
  totalsByAsset: Record<string, string>;
  /** Distinct asset identifiers present in this draft. */
  assets: string[];
  errors: DraftValidationError[];
  warnings: DraftWarning[];
  isValid: boolean;
}

/**
 * Result returned by `DraftBuilder.validate()`.
 * Errors are blocking; warnings are non-blocking and intended for review.
 */
export interface DraftValidationReport {
  errors: DraftValidationError[];
  warnings: DraftWarning[];
}
