/**
 * Appends primitive values to a growable byte buffer, in little-endian
 * order throughout. Pairs with {@link BinaryReader} for round-trip decoding.
 *
 * All multi-byte numeric fields (uint32, float64) use little-endian byte
 * order. This is an internal implementation detail of the wire format —
 * see `docs/BINARY_SERIALIZATION.md` for the full spec.
 */
export class BinaryWriter {
  private chunks: Uint8Array[] = [];
  private encoder = new TextEncoder();

  /** Writes a single unsigned byte (0–255). */
  writeUint8(value: number): this {
    this.chunks.push(Uint8Array.of(value & 0xff));
    return this;
  }

  /** Writes an unsigned 32-bit integer, little-endian. Used for lengths/counts. */
  writeUint32(value: number): this {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value, true);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Writes a JS `number` as an IEEE-754 double (8 bytes, little-endian).
   * Used instead of a fixed-width integer so timestamps and other numeric
   * fields round-trip exactly without range/precision assumptions.
   */
  writeFloat64(value: number): this {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setFloat64(0, value, true);
    this.chunks.push(buf);
    return this;
  }

  /** Writes a boolean as a single byte (0x00 | 0x01). */
  writeBool(value: boolean): this {
    return this.writeUint8(value ? 1 : 0);
  }

  /**
   * Writes a non-negative bigint as a uint32 byte-length prefix followed by
   * its minimal big-endian magnitude bytes. Zero is encoded as a
   * zero-length field (no magnitude bytes).
   */
  writeBigInt(value: bigint): this {
    if (value < 0n) {
      throw new RangeError("writeBigInt does not support negative values");
    }
    if (value === 0n) {
      return this.writeUint32(0);
    }
    const bytes: number[] = [];
    let remaining = value;
    while (remaining > 0n) {
      bytes.unshift(Number(remaining & 0xffn));
      remaining >>= 8n;
    }
    this.writeUint32(bytes.length);
    this.chunks.push(Uint8Array.from(bytes));
    return this;
  }

  /**
   * Writes a UTF-8 string as a uint32 byte-length prefix followed by its
   * encoded bytes.
   */
  writeString(value: string): this {
    const encoded = this.encoder.encode(value);
    this.writeUint32(encoded.length);
    this.chunks.push(encoded);
    return this;
  }

  /** Writes an array of strings as a uint32 count followed by each string. */
  writeStringArray(values: readonly string[]): this {
    this.writeUint32(values.length);
    for (const value of values) {
      this.writeString(value);
    }
    return this;
  }

  /** Concatenates all written chunks into a single contiguous buffer. */
  toBytes(): Uint8Array {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}
