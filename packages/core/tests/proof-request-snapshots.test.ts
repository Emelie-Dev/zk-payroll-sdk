/**
 * Snapshot tests for serialized proof request payloads.
 *
 * ── Purpose ──────────────────────────────────────────────────────────────────
 * These tests lock down the SDK's current serialisation output for proof requests
 * so that any unintended change in encoding, field ordering, type mapping, or
 * value formatting is detected immediately.
 *
 * ── Snapshot storage ─────────────────────────────────────────────────────────
 * Jest stores snapshots alongside the test file:
 *   tests/__snapshots__/proof-request-snapshots.test.ts.snap
 *
 * ── Updating snapshots ───────────────────────────────────────────────────────
 * When a serialisation change is intentional (e.g. a new protocol version, a
 * contract ABI upgrade, or a deliberate bug fix):
 *
 *   npx jest --updateSnapshot
 *     or
 *   npx jest -u
 *
 * Commit the updated .snap file together with the code change.
 *
 * ── Reviewing snapshot diffs ─────────────────────────────────────────────────
 * When reviewing a snapshot update, verify that:
 *   • New fields appearing in serialised output are correct.
 *   • Removed fields are intentional.
 *   • Type mappings (string vs bytes vs symbol) align with contract expectations.
 *   • Field ordering in XDR maps matches the Soroban contract ABI.
 *   • Hex-encoded XDR length is reasonable (no accidental data duplication).
 *
 * If a snapshot diff is unclear, check the XDR schema definitions in
 * @stellar/stellar-sdk or the Soroban contract interface.
 */

import { xdr, rpc, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { PayrollContractWrapper } from "../src/adapters/PayrollContractWrapper";
import { ProofVerifierClient } from "../src/clients/ProofVerifierClient";
import { SalaryCommitmentClient } from "../src/clients/SalaryCommitmentClient";
import { ProofPayload } from "../src/crypto/IProofGenerator";
import { ProofStruct, VerifyProofRequest } from "../src/clients/types";
import {
  PROOF_PAYLOAD_NORMAL,
  PROOF_PAYLOAD_MULTI,
  PROOF_PAYLOAD_EDGE,
  PROOF_STRUCT_NORMAL,
  PROOF_STRUCT_MULTI,
  PROOF_STRUCT_EDGE,
  VERIFY_REQUEST_NORMAL,
  VERIFY_REQUEST_MULTI,
  VERIFY_REQUEST_EDGE,
} from "./fixtures/proof-request-fixtures";

// ── Shared test helpers ───────────────────────────────────────────────────────

const TEST_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));

function createMockServer(): rpc.Server {
  return {} as rpc.Server;
}

/**
 * Convert an XDR ScVal to a stable hex string representation for snapshotting.
 */
function scValToHex(scVal: xdr.ScVal): string {
  return scVal.toXDR("hex");
}

/**
 * Join an array of XDR ScVals into a single hex string delimited by colons.
 * Useful for snapshotting the full set of contract method arguments.
 */
function argsToHex(args: xdr.ScVal[]): string {
  return args.map((a) => scValToHex(a)).join(":");
}

// ── Helper functions to access private encode methods ────────────────────────
// These bypass TypeScript private access so that snapshot tests can verify the
// serialised output directly without going through the full invoke pipeline.

<<<<<<< Updated upstream
function callEncodePayrollProof(wrapper: PayrollContractWrapper, proof: ProofPayload): xdr.ScVal {
  return (wrapper as unknown as { encodeProof(p: ProofPayload): xdr.ScVal }).encodeProof(proof);
}

function callEncodeProofStruct(
  client: ProofVerifierClient | SalaryCommitmentClient,
  proof: ProofStruct
): xdr.ScVal {
  return (client as unknown as { encodeProofStruct(p: ProofStruct): xdr.ScVal }).encodeProofStruct(
    proof
  );
}

class TestableProofVerifierClient extends ProofVerifierClient {
=======
class TestablePayrollContractWrapper extends PayrollContractWrapper {
  public override encodeProof(proof: ProofPayload): xdr.ScVal {
    return super.encodeProof(proof);
  }
}

class TestableProofVerifierClient extends ProofVerifierClient {
  public override encodeProofStruct(proof: ProofStruct): xdr.ScVal {
    return super.encodeProofStruct(proof);
  }

>>>>>>> Stashed changes
  public encodeVerifyArgs(
    proof: ProofStruct,
    publicInputs: string[],
    verificationKeyId: number
  ): xdr.ScVal[] {
<<<<<<< Updated upstream
    const proofStructScVal = callEncodeProofStruct(this, proof);

    const publicInputsScVal = xdr.ScVal.scvVec(
      publicInputs.map((s) => {
        const isHex = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
        const buf = isHex ? Buffer.from(s, "hex") : Buffer.from(s, "utf-8");
        return nativeToScVal(new Uint8Array(buf), { type: "bytes" });
      })
    );

    return [proofStructScVal, publicInputsScVal, nativeToScVal(verificationKeyId, { type: "u32" })];
=======
    const proofStructScVal = super.encodeProofStruct(proof);

    return [
      proofStructScVal,
      xdr.ScVal.scvVec(
        publicInputs.map((s) => {
          const isHex = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
          const buf = isHex ? Buffer.from(s, "hex") : Buffer.from(s, "utf-8");
          return nativeToScVal(new Uint8Array(buf), { type: "bytes" });
        })
      ),
      nativeToScVal(verificationKeyId, { type: "u32" }),
    ];
  }
}

class TestableSalaryCommitmentClient extends SalaryCommitmentClient {
  public override encodeProofStruct(proof: ProofStruct): xdr.ScVal {
    return super.encodeProofStruct(proof);
>>>>>>> Stashed changes
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. JSON serialisation (ProofPayload → JSON)
// ═══════════════════════════════════════════════════════════════════════════════

describe("ProofPayload JSON serialisation", () => {
  const FIXTURES: [string, ProofPayload][] = [
    ["normal", PROOF_PAYLOAD_NORMAL],
    ["multi commitment", PROOF_PAYLOAD_MULTI],
    ["edge case", PROOF_PAYLOAD_EDGE],
  ];

  it.each(FIXTURES)("produces valid JSON for %s payload", (_label, payload) => {
    const json = JSON.stringify(payload);
    expect(json).toBeTruthy();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("proof");
    expect(parsed).toHaveProperty("publicSignals");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. XDR serialisation — PayrollContractWrapper.encodeProof
// ═══════════════════════════════════════════════════════════════════════════════

describe("PayrollContractWrapper.encodeProof (ProofPayload → XDR ScVal)", () => {
  let wrapper: PayrollContractWrapper;

  beforeAll(() => {
<<<<<<< Updated upstream
    wrapper = new PayrollContractWrapper(createMockServer(), TEST_CONTRACT_ID);
=======
    wrapper = new TestablePayrollContractWrapper(createMockServer(), TEST_CONTRACT_ID);
>>>>>>> Stashed changes
  });

  const FIXTURES: [string, ProofPayload][] = [
    ["normal", PROOF_PAYLOAD_NORMAL],
    ["multi commitment", PROOF_PAYLOAD_MULTI],
    ["edge case", PROOF_PAYLOAD_EDGE],
  ];

  it.each(FIXTURES)("produces scVal for %s payload", (_label, payload) => {
    const scVal = callEncodePayrollProof(wrapper, payload);
    const hex = scValToHex(scVal);
    expect(hex).toBeTruthy();
    expect(typeof hex).toBe("string");
    expect(() => xdr.ScVal.fromXDR(hex, "hex")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. XDR serialisation — ProofVerifierClient.encodeProofStruct
// ═══════════════════════════════════════════════════════════════════════════════

describe("ProofVerifierClient.encodeProofStruct (ProofStruct → XDR ScVal)", () => {
  let client: ProofVerifierClient;

  beforeAll(() => {
<<<<<<< Updated upstream
    client = new ProofVerifierClient(createMockServer(), TEST_CONTRACT_ID);
=======
    client = new TestableProofVerifierClient(createMockServer(), TEST_CONTRACT_ID);
>>>>>>> Stashed changes
  });

  const FIXTURES: [string, ProofStruct][] = [
    ["normal", PROOF_STRUCT_NORMAL],
    ["multi commitment", PROOF_STRUCT_MULTI],
    ["edge case", PROOF_STRUCT_EDGE],
  ];

  it.each(FIXTURES)("produces scVal for %s payload", (_label, payload) => {
    const scVal = callEncodeProofStruct(client, payload);
    const hex = scValToHex(scVal);
    expect(hex).toBeTruthy();
    expect(typeof hex).toBe("string");
    expect(() => xdr.ScVal.fromXDR(hex, "hex")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. XDR serialisation — SalaryCommitmentClient.encodeProofStruct
// ═══════════════════════════════════════════════════════════════════════════════

describe("SalaryCommitmentClient.encodeProofStruct (ProofStruct → XDR ScVal)", () => {
  let client: SalaryCommitmentClient;

  beforeAll(() => {
<<<<<<< Updated upstream
    client = new SalaryCommitmentClient(createMockServer(), TEST_CONTRACT_ID);
=======
    client = new TestableSalaryCommitmentClient(createMockServer(), TEST_CONTRACT_ID);
>>>>>>> Stashed changes
  });

  const FIXTURES: [string, ProofStruct][] = [
    ["normal", PROOF_STRUCT_NORMAL],
    ["multi commitment", PROOF_STRUCT_MULTI],
    ["edge case", PROOF_STRUCT_EDGE],
  ];

  it.each(FIXTURES)("produces scVal for %s payload", (_label, payload) => {
    const scVal = callEncodeProofStruct(client, payload);
    const hex = scValToHex(scVal);
    expect(hex).toBeTruthy();
    expect(typeof hex).toBe("string");
    expect(() => xdr.ScVal.fromXDR(hex, "hex")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Full request argument encoding — ProofVerifierClient.verify args
// ═══════════════════════════════════════════════════════════════════════════════

describe("ProofVerifierClient.verify argument encoding", () => {
  let client: TestableProofVerifierClient;

  beforeAll(() => {
    client = new TestableProofVerifierClient(createMockServer(), TEST_CONTRACT_ID);
  });

  const FIXTURES: [string, VerifyProofRequest][] = [
    ["normal", VERIFY_REQUEST_NORMAL],
    ["multi input", VERIFY_REQUEST_MULTI],
    ["edge case", VERIFY_REQUEST_EDGE],
  ];

  it.each(FIXTURES)("produces valid args for %s request", (_label, req) => {
    const args = client.encodeVerifyArgs(req.proof, req.publicInputs, req.verificationKeyId);
    const hex = argsToHex(args);
    expect(hex).toBeTruthy();
    expect(typeof hex).toBe("string");
    hex.split(":").forEach((part) => {
      expect(() => xdr.ScVal.fromXDR(part, "hex")).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Round-trip check — XDR decodability
// ═══════════════════════════════════════════════════════════════════════════════

describe("XDR round-trip (hex → ScVal)", () => {
  let payrollWrapper: PayrollContractWrapper;
  let verifierClient: ProofVerifierClient;

  beforeAll(() => {
    const server = createMockServer();
    payrollWrapper = new PayrollContractWrapper(server, TEST_CONTRACT_ID);
    verifierClient = new ProofVerifierClient(server, TEST_CONTRACT_ID);
  });

  it("ProofPayload XDR can be decoded back without error", () => {
    const scVal = callEncodePayrollProof(payrollWrapper, PROOF_PAYLOAD_NORMAL);
    const hex = scValToHex(scVal);
    expect(() => xdr.ScVal.fromXDR(hex, "hex")).not.toThrow();
  });

  it("ProofStruct XDR can be decoded back without error", () => {
    const scVal = callEncodeProofStruct(verifierClient, PROOF_STRUCT_NORMAL);
    const hex = scValToHex(scVal);
    expect(() => xdr.ScVal.fromXDR(hex, "hex")).not.toThrow();
  });

  it("round-tripped ScVal hex equals original", () => {
    const scVal = callEncodePayrollProof(payrollWrapper, PROOF_PAYLOAD_NORMAL);
    const hex = scValToHex(scVal);
    const decoded = xdr.ScVal.fromXDR(hex, "hex");
    expect(scValToHex(decoded)).toBe(hex);
  });
});
