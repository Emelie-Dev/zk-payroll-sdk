import { RedactionOptions, RedactionResult } from "./types";

/** Fields that are always redacted regardless of caller options. */
const DEFAULT_SENSITIVE_FIELDS = new Set([
  "recipient",
  "amount",
  "witness",
  "privateKey",
  "adminKey",
  "secret",
  "password",
  "token",
  "mnemonic",
  "seed",
  "authorization",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "signingKey",
]);

function buildFieldSet(options: RedactionOptions = {}): Set<string> {
  const set = new Set(DEFAULT_SENSITIVE_FIELDS);
  for (const field of options.additionalFields ?? []) {
    set.add(field);
  }
  return set;
}

function maskValue(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return value.slice(0, 2) + "*".repeat(value.length - 4) + value.slice(-2);
}

function applyRedaction(value: unknown, options: RedactionOptions): unknown {
  const mode = options.mode ?? "placeholder";
  if (mode === "remove") return undefined;
  if (mode === "mask") {
    const str = typeof value === "string" ? value : String(value);
    return maskValue(str);
  }
  return options.placeholder ?? "[redacted]";
}

/**
 * Redacts sensitive fields from a plain object (shallow).
 *
 * Returns the cleaned object and a list of which keys were redacted so
 * callers can log or audit what was stripped.
 *
 * @example
 * const { redacted } = redactObject({ recipient: "G...", amount: 500n, txHash: "abc" });
 * // { txHash: "abc", recipient: "[redacted]", amount: "[redacted]" }
 */
export function redactObject(
  obj: Record<string, unknown>,
  options: RedactionOptions = {}
): RedactionResult<Record<string, unknown>> {
  const sensitiveFields = buildFieldSet(options);
  const result: Record<string, unknown> = {};
  const fieldsRedacted: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.has(key)) {
      const replacement = applyRedaction(value, options);
      if (replacement !== undefined) {
        result[key] = replacement;
      }
      fieldsRedacted.push(key);
    } else {
      result[key] = value;
    }
  }

  return { redacted: result, fieldsRedacted };
}

/**
 * Recursively redacts sensitive fields from a nested object.
 *
 * Arrays are traversed element-by-element. Primitive values at the
 * top level are returned unchanged.
 */
export function redactDeep(
  value: unknown,
  options: RedactionOptions = {},
  _fieldsRedacted: string[] = []
): RedactionResult<unknown> {
  const sensitiveFields = buildFieldSet(options);
  const fieldsRedacted: string[] = _fieldsRedacted;

  function walk(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map((item) => walk(item));
    }
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
        if (sensitiveFields.has(key)) {
          const replacement = applyRedaction(val, options);
          if (replacement !== undefined) {
            out[key] = replacement;
          }
          if (!fieldsRedacted.includes(key)) fieldsRedacted.push(key);
        } else {
          out[key] = walk(val);
        }
      }
      return out;
    }
    return v;
  }

  return { redacted: walk(value), fieldsRedacted };
}

/**
 * Redacts sensitive values from an error's message and any attached context.
 *
 * Creates a new Error with the same constructor, sanitized message, and
 * the original stack preserved so stack traces remain useful.
 */
export function redactError(error: Error, options: RedactionOptions = {}): Error {
  const sensitiveFields = buildFieldSet(options);
  const placeholder = options.placeholder ?? "[redacted]";

  let message = error.message;
  for (const field of sensitiveFields) {
    const pattern = new RegExp(`(${field}\\s*[:=]\\s*)([^\\s,}]+)`, "gi");
    message = message.replace(pattern, `$1${placeholder}`);
  }

  const sanitized = new (error.constructor as ErrorConstructor)(message);
  sanitized.stack = error.stack;
  return sanitized;
}

/**
 * Returns the set of field names that the SDK considers sensitive by default.
 * Consumers can use this to understand the baseline redaction behaviour.
 */
export function getDefaultSensitiveFields(): string[] {
  return Array.from(DEFAULT_SENSITIVE_FIELDS);
}
