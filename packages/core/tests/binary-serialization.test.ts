import {
  encodeProofPayload,
  decodeProofPayload,
  encodeProofStruct,
  decodeProofStruct,
  encodeCommitmentEntry,
  decodeCommitmentEntry,
  encodeCommitRequest,
  decodeCommitRequest,
  SerializationError,
  PayloadTypeTag,
  SERIALIZATION_FORMAT_VERSION,
} from "../src/serialization";

import {
  PROOF_PAYLOAD_NORMAL,
  PROOF_PAYLOAD_MULTI,
  PROOF_PAYLOAD_EDGE,
  PROOF_STRUCT_NORMAL,
  PROOF_STRUCT_MULTI,
  PROOF_STRUCT_EDGE,
} from "./fixtures/proof-request-fixtures";

import {
  COMMITMENT_ENTRY_NORMAL,
  COMMITMENT_ENTRY_REVEALED,
  COMMITMENT_ENTRY_EDGE,
  COMMIT_REQUEST_NORMAL,
  COMMIT_REQUEST_EDGE,
} from "./fixtures/commitment-fixtures";

describe("Binary serialization — ProofPayload", () => {
  it.each([
    ["normal", PROOF_PAYLOAD_NORMAL],
    ["multi-signal", PROOF_PAYLOAD_MULTI],
    ["edge-case values", PROOF_PAYLOAD_EDGE],
  ])("round-trips a %s payload", (_label, payload) => {
    const bytes = encodeProofPayload(payload);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(decodeProofPayload(bytes)).toEqual(payload);
  });

  it("produces a binary-safe buffer, not a JSON/text encoding", () => {
    const bytes = encodeProofPayload(PROOF_PAYLOAD_NORMAL);
    // Byte 0 is the format version, byte 1 is the type tag — neither is
    // printable JSON syntax like '{' (0x7b) or '"' (0x22).
    expect(bytes[0]).toBe(SERIALIZATION_FORMAT_VERSION);
    expect(bytes[1]).toBe(PayloadTypeTag.PROOF_PAYLOAD);
  });

  it("round-trips an empty publicSignals array", () => {
    const payload = { ...PROOF_PAYLOAD_NORMAL, publicSignals: [] };
    expect(decodeProofPayload(encodeProofPayload(payload))).toEqual(payload);
  });
});

describe("Binary serialization — ProofStruct", () => {
  it.each([
    ["normal", PROOF_STRUCT_NORMAL],
    ["multi-signal", PROOF_STRUCT_MULTI],
    ["edge-case values", PROOF_STRUCT_EDGE],
  ])("round-trips a %s struct", (_label, struct) => {
    const bytes = encodeProofStruct(struct);
    expect(decodeProofStruct(bytes)).toEqual(struct);
  });

  it("rejects a buffer encoded as ProofPayload when decoding as ProofStruct", () => {
    const bytes = encodeProofPayload(PROOF_PAYLOAD_NORMAL);
    expect(() => decodeProofStruct(bytes)).toThrow(SerializationError);
    expect(() => decodeProofStruct(bytes)).toThrow(/type tag mismatch/i);
  });
});

describe("Binary serialization — CommitmentEntry", () => {
  it.each([
    ["normal", COMMITMENT_ENTRY_NORMAL],
    ["revealed / large values", COMMITMENT_ENTRY_REVEALED],
    ["edge-case empty values", COMMITMENT_ENTRY_EDGE],
  ])("round-trips a %s entry", (_label, entry) => {
    const bytes = encodeCommitmentEntry(entry);
    expect(decodeCommitmentEntry(bytes)).toEqual(entry);
  });

  it("preserves bigint type and large magnitude across the round trip", () => {
    const bytes = encodeCommitmentEntry(COMMITMENT_ENTRY_REVEALED);
    const decoded = decodeCommitmentEntry(bytes);
    expect(typeof decoded.cycleId).toBe("bigint");
    expect(decoded.cycleId).toBe(18446744073709551615n);
    expect(decoded.actualAmount).toBe(9007199254740993n);
  });

  it("preserves fractional timestamps exactly via float64 encoding", () => {
    const bytes = encodeCommitmentEntry(COMMITMENT_ENTRY_REVEALED);
    expect(decodeCommitmentEntry(bytes).createdAt).toBe(1893456000.5);
  });
});

describe("Binary serialization — CommitRequest", () => {
  it.each([
    ["normal", COMMIT_REQUEST_NORMAL],
    ["unicode / large cycleId", COMMIT_REQUEST_EDGE],
  ])("round-trips a %s request", (_label, request) => {
    const bytes = encodeCommitRequest(request);
    expect(decodeCommitRequest(bytes)).toEqual(request);
  });

  it("rejects a CommitmentEntry buffer when decoding as CommitRequest", () => {
    const bytes = encodeCommitmentEntry(COMMITMENT_ENTRY_NORMAL);
    expect(() => decodeCommitRequest(bytes)).toThrow(SerializationError);
  });
});

describe("Binary serialization — malformed input handling", () => {
  it("throws on a truncated buffer instead of returning garbage", () => {
    const bytes = encodeCommitRequest(COMMIT_REQUEST_NORMAL);
    const truncated = bytes.slice(0, bytes.length - 5);
    expect(() => decodeCommitRequest(truncated)).toThrow(SerializationError);
    expect(() => decodeCommitRequest(truncated)).toThrow(/unexpected end of buffer/i);
  });

  it("throws on an empty buffer", () => {
    expect(() => decodeProofStruct(new Uint8Array(0))).toThrow(SerializationError);
  });

  it("throws on an unsupported format version", () => {
    const bytes = encodeProofStruct(PROOF_STRUCT_NORMAL);
    const corrupted = Uint8Array.from(bytes);
    corrupted[0] = 99; // not a real version
    expect(() => decodeProofStruct(corrupted)).toThrow(/version/i);
  });

  it("throws on trailing bytes after a valid payload", () => {
    const bytes = encodeCommitRequest(COMMIT_REQUEST_NORMAL);
    const withTrailingJunk = new Uint8Array(bytes.length + 3);
    withTrailingJunk.set(bytes);
    withTrailingJunk.set([1, 2, 3], bytes.length);
    expect(() => decodeCommitRequest(withTrailingJunk)).toThrow(/trailing/i);
  });
});

describe("Binary serialization — cross-type isolation", () => {
  it("assigns a unique tag to every payload type", () => {
    const tags = Object.values(PayloadTypeTag);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
