import { BinaryWriter } from "./BinaryWriter";
import { BinaryReader } from "./BinaryReader";
import { SerializationError } from "./errors";
import { PayloadTypeTag, SERIALIZATION_FORMAT_VERSION } from "./proofSerialization";
import { CommitmentEntry, CommitRequest } from "../clients/types";

function writeHeader(writer: BinaryWriter, tag: number): void {
  writer.writeUint8(SERIALIZATION_FORMAT_VERSION).writeUint8(tag);
}

function readHeader(reader: BinaryReader, expectedTag: number): void {
  const version = reader.readUint8();
  if (version !== SERIALIZATION_FORMAT_VERSION) {
    throw new SerializationError(
      `Unsupported serialization format version ${version} (expected ${SERIALIZATION_FORMAT_VERSION}).`,
      "SERIALIZATION_VERSION_MISMATCH"
    );
  }
  const tag = reader.readUint8();
  if (tag !== expectedTag) {
    throw new SerializationError(
      `Payload type tag mismatch: expected 0x${expectedTag.toString(16)}, got 0x${tag.toString(16)}.`,
      "SERIALIZATION_TYPE_MISMATCH"
    );
  }
}

/**
 * Encodes a {@link CommitmentEntry} (a salary commitment as stored/returned
 * by the contract, including reveal state) into a binary-safe buffer.
 */
export function encodeCommitmentEntry(entry: CommitmentEntry): Uint8Array {
  const writer = new BinaryWriter();
  writeHeader(writer, PayloadTypeTag.COMMITMENT_ENTRY);
  writer
    .writeString(entry.employer)
    .writeString(entry.employee)
    .writeString(entry.commitmentHash)
    .writeBigInt(entry.cycleId)
    .writeFloat64(entry.createdAt)
    .writeBool(entry.revealed)
    .writeBigInt(entry.actualAmount);
  return writer.toBytes();
}

/** Decodes a buffer produced by {@link encodeCommitmentEntry} back into a {@link CommitmentEntry}. */
export function decodeCommitmentEntry(bytes: Uint8Array): CommitmentEntry {
  const reader = new BinaryReader(bytes);
  readHeader(reader, PayloadTypeTag.COMMITMENT_ENTRY);
  const entry: CommitmentEntry = {
    employer: reader.readString(),
    employee: reader.readString(),
    commitmentHash: reader.readString(),
    cycleId: reader.readBigInt(),
    createdAt: reader.readFloat64(),
    revealed: reader.readBool(),
    actualAmount: reader.readBigInt(),
  };
  reader.assertExhausted();
  return entry;
}

/**
 * Encodes a {@link CommitRequest} (the payload sent to commit a salary
 * hash on-chain) into a binary-safe buffer.
 */
export function encodeCommitRequest(request: CommitRequest): Uint8Array {
  const writer = new BinaryWriter();
  writeHeader(writer, PayloadTypeTag.COMMIT_REQUEST);
  writer
    .writeString(request.employer)
    .writeString(request.employee)
    .writeString(request.commitmentHash)
    .writeBigInt(request.cycleId);
  return writer.toBytes();
}

/** Decodes a buffer produced by {@link encodeCommitRequest} back into a {@link CommitRequest}. */
export function decodeCommitRequest(bytes: Uint8Array): CommitRequest {
  const reader = new BinaryReader(bytes);
  readHeader(reader, PayloadTypeTag.COMMIT_REQUEST);
  const request: CommitRequest = {
    employer: reader.readString(),
    employee: reader.readString(),
    commitmentHash: reader.readString(),
    cycleId: reader.readBigInt(),
  };
  reader.assertExhausted();
  return request;
}
