import { ValidationError } from "./errors";
import { PaymentParams } from "../types";
import {
  BatchPaymentEntry,
  BatchPayload,
  BatchValidationError,
  BatchPayloadBuilder,
  validateBatchPayload,
} from "../batch/BatchPayloadBuilder";

export interface ValidationResult {
  isValid: boolean;
  errors: { field: string; message: string }[];
}

export class PayrollValidation {
  /**
   * Validates payment parameters locally before network interaction.
   * Helps avoid avoidable RPC calls.
   *
   * @param params - The payment parameters to validate.
   * @returns A ValidationResult indicating if the parameters are valid and listing any errors.
   */
  static validatePaymentParams(params: PaymentParams): ValidationResult {
    const errors: { field: string; message: string }[] = [];

    if (!params.recipient || params.recipient.trim() === "") {
      errors.push({ field: "recipient", message: "Recipient address is required" });
    }

    if (params.amount === undefined || params.amount === null || params.amount <= 0n) {
      errors.push({ field: "amount", message: "Amount must be a positive value" });
    }

    if (!params.asset || params.asset.trim() === "") {
      errors.push({ field: "asset", message: "Asset identifier is required" });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Throws a ValidationError for the first invalid field in the payment parameters.
   *
   * @param params - The payment parameters to validate.
   * @throws {ValidationError} If the parameters are invalid.
   */
  static assertValidPaymentParams(params: PaymentParams): void {
    const result = this.validatePaymentParams(params);
    if (!result.isValid) {
      const firstError = result.errors[0];
      throw new ValidationError(firstError.message, firstError.field);
    }
  }

  /**
   * Validates a batch payload locally before processing.
   *
   * @param entries - Payment entries array to validate.
   * @returns BatchValidationError array; empty array if valid.
   */
  static validateBatchPayload(entries: BatchPaymentEntry[]): BatchValidationError[] {
    return validateBatchPayload(entries);
  }

  /**
   * Asserts that a batch payload is valid, returning the built BatchPayload object.
   *
   * @param entries - Payment entries array to validate.
   * @throws {BatchValidationFailedError} If validation fails.
   */
  static assertValidBatchPayload(entries: BatchPaymentEntry[]): BatchPayload {
    const builder = new BatchPayloadBuilder();
    builder.addMany(entries);
    return builder.build();
  }
}
