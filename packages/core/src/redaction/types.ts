export type RedactionMode = "mask" | "remove" | "placeholder";

export interface RedactionOptions {
  /** How to handle sensitive values. Defaults to "placeholder". */
  mode?: RedactionMode;
  /** Custom replacement string when mode is "placeholder". Defaults to "[redacted]". */
  placeholder?: string;
  /** Additional field names to treat as sensitive, merged with built-in defaults. */
  additionalFields?: string[];
}

export interface RedactionResult<T> {
  redacted: T;
  fieldsRedacted: string[];
}
