import { ZkPayrollError } from "../core/errors";
import { DraftValidationError } from "./types";

/**
 * Thrown by `DraftBuilder.build()` when the draft has blocking validation
 * errors. Warnings (e.g. MIXED_ASSETS) are not surfaced here — review-first
 * flows intentionally allow drafts with warnings to be serialized.
 */
export class DraftValidationFailedError extends ZkPayrollError {
  constructor(public readonly errors: DraftValidationError[]) {
    super(`Draft validation failed with ${errors.length} error(s)`, "DRAFT_VALIDATION_FAILED");
  }
}
