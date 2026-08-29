import { ZkPayrollError, ErrorContext } from "../core/errors";

/**
 * Thrown when binary encoding or decoding of a proof/commitment payload
 * fails — truncated buffers, type-tag mismatches, or unsupported format
 * versions.
 */
export class SerializationError extends ZkPayrollError {
  constructor(message: string, code: string = "SERIALIZATION_FAILED", context: ErrorContext = {}) {
    super(message, code, context);
  }
}
