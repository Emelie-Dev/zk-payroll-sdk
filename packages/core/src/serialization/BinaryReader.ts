import { SerializationError } from "./errors";

/**
 * Reads primitive values sequentially from a byte buffer, mirroring
 * {@link BinaryWriter}'s little-endian wire format. Every read advances an
 * internal cursor; out-of-bounds reads throw {@link SerializationError}
 * instead of returning undefined/garbage, so truncated or corrupt buffers
 * fail fast and loudly.
 */
export class BinaryReader {
  private offset = 0;
  private view: DataView;
  private decoder = new TextDecoder();

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Number of bytes remaining after the current cursor position. */
  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  private ensure(byteCount: number): void {
    if (this.remaining < byteCount) {
      throw new SerializationError(
        `Unexpected end of buffer: need ${byteCount} byte(s) at offset ${this.offset}, ` +
          `only ${this.remaining} remaining.`,
        "SERIALIZATION_TRUNCATED"
      );
    }
  }

  readUint8(): number {
    this.ensure(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    this.ensure(8);
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBool(): boolean {
    return this.readUint8() !== 0;
  }

  readBigInt(): bigint {
    const length = this.readUint32();
    if (length === 0) {
      return 0n;
    }
    this.ensure(length);
    let value = 0n;
    for (let i = 0; i < length; i++) {
      value = (value << 8n) | BigInt(this.bytes[this.offset + i]);
    }
    this.offset += length;
    return value;
  }

  readString(): string {
    const length = this.readUint32();
    this.ensure(length);
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return this.decoder.decode(slice);
  }

  readStringArray(): string[] {
    const count = this.readUint32();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      values.push(this.readString());
    }
    return values;
  }

  /**
   * Asserts the buffer has been fully consumed. Useful at the end of a
   * decode to catch payloads with unexpected trailing bytes.
   */
  assertExhausted(): void {
    if (this.remaining !== 0) {
      throw new SerializationError(
        `Buffer has ${this.remaining} unexpected trailing byte(s) after decoding.`,
        "SERIALIZATION_TRAILING_BYTES"
      );
    }
  }
}
